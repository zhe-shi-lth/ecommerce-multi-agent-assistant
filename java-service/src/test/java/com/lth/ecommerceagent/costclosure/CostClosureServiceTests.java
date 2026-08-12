package com.lth.ecommerceagent.costclosure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.audit.BusinessAuditLogRepository;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderCompletionService;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.order.ShipRequest;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonShipResult;
import com.lth.ecommerceagent.purchase.CreatePurchaseOrderRequest;
import com.lth.ecommerceagent.purchase.PurchaseOrderRepository;
import com.lth.ecommerceagent.purchase.PurchaseService;
import com.lth.ecommerceagent.purchase.StockInRequest;
import com.lth.ecommerceagent.supplier.Supplier;
import com.lth.ecommerceagent.supplier.SupplierRepository;
import com.lth.ecommerceagent.aftersale.AfterSalesRepository;
import com.lth.ecommerceagent.aftersale.AfterSalesRequest;
import com.lth.ecommerceagent.aftersale.AfterSalesService;
import com.lth.ecommerceagent.aftersale.ReturnReceiveRequest;

/**
 * 成本闭环业务校验（锁定「算得准、异常拦得住」）：
 * - 采购成本：unitCost 必填且 > 0；总成本/单件综合成本自动算。
 * - 入库数量：未传默认采购数量；<=0 或 >采购数量 直接报错。
 * - 发货运费：必填（包邮填 0）；不能为负；来源仅 MANUAL/TEMPLATE。
 * - 毛利快照：发货成功时写入 grossProfit = payment - 商品成本 - 发货运费。
 */
@SpringBootTest
class CostClosureServiceTests {

    @MockBean
    private PythonAgentClient pythonAgentClient;

    @Autowired
    private PurchaseService purchaseService;
    @Autowired
    private OrderCompletionService orderCompletionService;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private SupplierRepository supplierRepository;
    @Autowired
    private InventoryRepository inventoryRepository;
    @Autowired
    private PurchaseOrderRepository purchaseOrderRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private BusinessAuditLogRepository auditLogRepository;
    @Autowired
    private AfterSalesService afterSalesService;
    @Autowired
    private AfterSalesRepository afterSalesRepository;

    private Product product(BigDecimal costPrice) {
        Product p = new Product();
        p.setName("测试商品");
        p.setCategory("测试");
        p.setDescription("测试商品描述");
        p.setCostPrice(costPrice);
        p.setSalePrice(new BigDecimal("99.00"));
        p.setTargetAudience("测试受众");
        p.setUsageScenario("测试场景");
        p.setStatus("PUBLISHED");
        return productRepository.save(p);
    }

    private Inventory inventory(Product p, int stock) {
        Inventory inv = new Inventory();
        inv.setProduct(p);
        inv.setCurrentStock(stock);
        inv.setReservedStock(0);
        inv.setSafeStockThreshold(10);
        inv.setPurchaseCycleDays(5);
        inv.setSalesLast7Days(0);
        inv.setInventoryStatus("ENOUGH");
        return inventoryRepository.save(inv);
    }

    private Supplier supplier() {
        Supplier s = new Supplier();
        s.setName("测试进货商家" + System.nanoTime());
        s.setStatus(Supplier.Status.ACTIVE);
        s.setLeadTimeDays(3);
        return supplierRepository.save(s);
    }

    private Order readyToShipOrder(Product p, BigDecimal payment, int qty) {
        if (inventoryRepository.findByProductId(p.getId()).isEmpty()) {
            inventory(p, qty);
        }
        Order o = new Order();
        o.setProduct(p);
        o.setPlatform("mock");
        o.setPlatformOrderId("MOCKSHIP" + System.nanoTime());
        o.setQuantity(qty);
        o.setStatus("READY_TO_SHIP");
        o.setAddressComplete(true);
        o.setPaid(true);
        o.setManualReviewRequired(false);
        o.setFulfillmentSuggestionStatus("READY_TO_SHIP");
        o.setPayment(payment);
        o.setPostFee(BigDecimal.ZERO);
        Order saved = orderRepository.save(o);
        return orderCompletionService.reserveImportedOrder(saved);
    }

    // ===== 采购成本校验 =====

    @Test
    void createRejectsMissingUnitCost() {
        Product p = product(new BigDecimal("39.00"));
        Supplier s = supplier();
        CreatePurchaseOrderRequest req =
                new CreatePurchaseOrderRequest(p.getId(), 10, s.getId(), null, null, null, null);
        assertThatThrownBy(() -> purchaseService.create(req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void createRejectsZeroUnitCost() {
        Product p = product(new BigDecimal("39.00"));
        Supplier s = supplier();
        CreatePurchaseOrderRequest req =
                new CreatePurchaseOrderRequest(p.getId(), 10, s.getId(), BigDecimal.ZERO, BigDecimal.ZERO, null, null);
        assertThatThrownBy(() -> purchaseService.create(req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void createComputesCosts() {
        Product p = product(new BigDecimal("39.00"));
        Supplier s = supplier();
        CreatePurchaseOrderRequest req = new CreatePurchaseOrderRequest(
                p.getId(), 10, s.getId(), new BigDecimal("10.00"), new BigDecimal("20.00"), null, null);
        var po = purchaseService.create(req);

        assertThat(po.productAmount()).isEqualByComparingTo("100.00"); // 10 * 10
        assertThat(po.totalCost()).isEqualByComparingTo("120.00"); // 100 + 20
        assertThat(po.landedUnitCost()).isEqualByComparingTo("12.00"); // 120 / 10
        assertThat(po.actualQuantity()).isZero();
        assertThat(po.receivedQuantity()).isZero();
        assertThat(po.remainingQuantity()).isEqualTo(10);
        assertThat(po.status()).isEqualTo("PENDING_APPROVAL");
    }

    @Test
    void unapprovedPurchaseCannotBeMarkedOrdered() {
        Product p = product(new BigDecimal("39.00"));
        Supplier s = supplier();
        CreatePurchaseOrderRequest req = new CreatePurchaseOrderRequest(
                p.getId(), 10, s.getId(), new BigDecimal("10.00"), BigDecimal.ZERO, null, null);
        var po = purchaseService.create(req);
        assertThatThrownBy(() -> purchaseService.markOrdered(po.id()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void approveMovesPurchaseApplicationToCreated() {
        Product p = product(new BigDecimal("39.00"));
        Supplier s = supplier();
        var po = purchaseService.create(new CreatePurchaseOrderRequest(
                p.getId(), 10, s.getId(), new BigDecimal("10.00"), BigDecimal.ZERO, null, null));
        var approved = purchaseService.approve(po.id());
        assertThat(approved.status()).isEqualTo("CREATED");
        assertThat(auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
                "PURCHASE_ORDER", po.id()))
                .extracting("action")
                .contains("CREATE_REQUEST", "APPROVE");
    }

    @Test
    void purchaseLifecycleRequiresEveryTransitionAndWritesAudit() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 0);
        Supplier s = supplier();
        var po = purchaseService.create(new CreatePurchaseOrderRequest(
                p.getId(), 10, s.getId(), new BigDecimal("10.00"), BigDecimal.ZERO, null, null));

        assertThatThrownBy(() -> purchaseService.markInbound(po.id()))
                .isInstanceOf(ResponseStatusException.class);
        purchaseService.approve(po.id());
        purchaseService.markOrdered(po.id());
        purchaseService.markInbound(po.id());
        purchaseService.stockIn(po.id(), new StockInRequest(10, "全量到货"));

        assertThat(purchaseOrderRepository.findById(po.id()).orElseThrow().getStatus()).isEqualTo("STOCKED");
        assertThat(auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
                "PURCHASE_ORDER", po.id()))
                .extracting("action")
                .containsExactly("STOCK_IN", "MARK_INBOUND", "MARK_ORDERED", "APPROVE", "CREATE_REQUEST");
    }

    @Test
    void createRejectsMissingSupplier() {
        Product p = product(new BigDecimal("39.00"));
        CreatePurchaseOrderRequest req = new CreatePurchaseOrderRequest(
                p.getId(), 10, null, new BigDecimal("10.00"), BigDecimal.ZERO, null, null);
        assertThatThrownBy(() -> purchaseService.create(req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void createRejectsDisabledSupplier() {
        Product p = product(new BigDecimal("39.00"));
        Supplier s = supplier();
        s.setStatus(Supplier.Status.DISABLED);
        supplierRepository.save(s);
        var req = new CreatePurchaseOrderRequest(
                p.getId(), 10, s.getId(), new BigDecimal("10.00"), BigDecimal.ZERO, null, null);
        assertThatThrownBy(() -> purchaseService.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("已停用");
    }

    // ===== 入库数量校验 =====

    private Long toInbound(Product p, int qty) {
        Supplier s = supplier();
        var po = purchaseService.create(new CreatePurchaseOrderRequest(
                p.getId(), qty, s.getId(), new BigDecimal("10.00"), BigDecimal.ZERO, null, null));
        purchaseService.approve(po.id());
        purchaseService.markOrdered(po.id());
        purchaseService.markInbound(po.id());
        return po.id();
    }

    @Test
    void stockInRejectsNonPositiveActual() {
        Product p = product(new BigDecimal("39.00"));
        Long poId = toInbound(p, 10);
        assertThatThrownBy(() -> purchaseService.stockIn(poId, new StockInRequest(0, "破损")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void stockInAllowsOverPurchaseAsGiftOrOverDelivery() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 0);
        Long poId = toInbound(p, 10);
        purchaseService.stockIn(poId, new StockInRequest(11, "供应商多发1件"));
        Inventory after = inventoryRepository.findByProductId(p.getId()).orElseThrow();
        assertThat(after.getCurrentStock()).isEqualTo(11);
    }

    @Test
    void stockInSupportsMultipleReceiptBatches() {
        Product p = product(new BigDecimal("39.00"));
        Inventory inv = inventory(p, 0);
        // 采购 10 件，先到 8 件保持采购单打开，再到 2 件后关闭。
        Long poId = toInbound(p, 10);
        var first = purchaseService.stockIn(poId, new StockInRequest("BATCH-1", 8, "先到8件"));

        Inventory after = inventoryRepository.findByProductId(p.getId()).orElseThrow();
        assertThat(after.getCurrentStock()).isEqualTo(8);
        assertThat(first.purchaseOrder().status()).isEqualTo("PARTIALLY_RECEIVED");
        assertThat(first.purchaseOrder().receivedQuantity()).isEqualTo(8);
        assertThat(first.purchaseOrder().remainingQuantity()).isEqualTo(2);

        var second = purchaseService.stockIn(poId, new StockInRequest("BATCH-2", 2, "尾批"));
        assertThat(second.purchaseOrder().status()).isEqualTo("STOCKED");
        assertThat(inventoryRepository.findByProductId(p.getId()).orElseThrow().getCurrentStock()).isEqualTo(10);
        assertThat(purchaseService.receipts(poId)).extracting("receiptNo")
                .containsExactly("BATCH-1", "BATCH-2");

        Product afterP = productRepository.findById(p.getId()).orElseThrow();
        assertThat(afterP.getCostPrice()).isEqualByComparingTo("10.00");
    }

    @Test
    void partiallyReceivedPurchaseCanCloseShort() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 0);
        Long poId = toInbound(p, 10);
        purchaseService.stockIn(poId, new StockInRequest("SHORT-1", 8, "少到2件"));

        var closed = purchaseService.closeShort(poId, "供应商确认不再补发");

        assertThat(closed.status()).isEqualTo("CLOSED_SHORT");
        assertThat(closed.receivedQuantity()).isEqualTo(8);
        assertThat(closed.remainingQuantity()).isEqualTo(2);
        assertThat(closed.totalCost()).isEqualByComparingTo("80.00");
        assertThat(auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
                "PURCHASE_ORDER", poId)).extracting("action").contains("CLOSE_SHORT");
    }

    @Test
    void purchaseWithoutReceiptsCanBeCancelled() {
        Product p = product(new BigDecimal("39.00"));
        Supplier s = supplier();
        var po = purchaseService.create(new CreatePurchaseOrderRequest(
                p.getId(), 5, s.getId(), new BigDecimal("10.00"), BigDecimal.ZERO, null, null));
        var cancelled = purchaseService.cancel(po.id(), "不再采购");
        assertThat(cancelled.status()).isEqualTo("CANCELLED");
    }

    // ===== 发货运费校验 + 毛利快照 =====

    @Test
    void shipRejectsNullShippingFee() {
        Product p = product(new BigDecimal("39.00"));
        Order o = readyToShipOrder(p, new BigDecimal("100.00"), 2);
        ShipRequest req = new ShipRequest("顺丰速运", "SF123", null, "MANUAL");
        assertThatThrownBy(() -> orderCompletionService.ship(o, req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void shipRejectsNegativeShippingFee() {
        Product p = product(new BigDecimal("39.00"));
        Order o = readyToShipOrder(p, new BigDecimal("100.00"), 2);
        ShipRequest req = new ShipRequest("顺丰速运", "SF123", new BigDecimal("-1"), "MANUAL");
        assertThatThrownBy(() -> orderCompletionService.ship(o, req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void shipRejectsBadFeeType() {
        Product p = product(new BigDecimal("39.00"));
        Order o = readyToShipOrder(p, new BigDecimal("100.00"), 2);
        ShipRequest req = new ShipRequest("顺丰速运", "SF123", new BigDecimal("5"), "NOPE");
        assertThatThrownBy(() -> orderCompletionService.ship(o, req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void shipWritesSnapshotAndGrossProfit() {
        Product p = product(new BigDecimal("39.00")); // 成本 39
        Order o = readyToShipOrder(p, new BigDecimal("100.00"), 2); // 商品成本 78
        when(pythonAgentClient.shipOrder(any())).thenReturn(new PythonShipResult(true, "ok", ""));

        Order shipped = orderCompletionService.ship(o, new ShipRequest("顺丰速运", "SF123", new BigDecimal("5"), "MANUAL"));

        assertThat(shipped.getStatus()).isEqualTo("SHIPPED");
        assertThat(shipped.getShippingFee()).isEqualByComparingTo("5");
        assertThat(shipped.getShippingFeeType()).isEqualTo("MANUAL");
        // 毛利 = 100 - 78 - 5 = 17
        assertThat(shipped.getGrossProfit()).isEqualByComparingTo("17.00");
        assertThat(shipped.getGoodsCostSnapshot()).isEqualByComparingTo("78.00");
        assertThat(auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc("ORDER", o.getId()))
                .extracting("action")
                .contains("SHIP");
    }

    @Test
    void atomicStockReservationPreventsSecondOrderFromTakingSameStock() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 1);
        Order reserved = readyToShipOrder(p, new BigDecimal("99.00"), 1);
        assertThat(reserved.getStatus()).isEqualTo("READY_TO_SHIP");
        Order competing = new Order();
        competing.setProduct(p);
        competing.setPlatform("mock");
        competing.setPlatformOrderId("MOCK-COMPETE" + System.nanoTime());
        competing.setQuantity(1);
        competing.setStatus("READY_TO_SHIP");
        competing.setAddressComplete(true);
        competing.setPaid(true);
        competing.setManualReviewRequired(false);
        competing.setFulfillmentSuggestionStatus("READY_TO_SHIP");
        competing.setPayment(new BigDecimal("99.00"));
        competing.setPostFee(BigDecimal.ZERO);
        competing = orderRepository.save(competing);
        Order rejected = orderCompletionService.reserveImportedOrder(competing);
        assertThat(rejected.getStatus()).isEqualTo("INSUFFICIENT_STOCK");
        Inventory after = inventoryRepository.findByProductId(p.getId()).orElseThrow();
        assertThat(after.getCurrentStock()).isEqualTo(1);
        assertThat(after.getReservedStock()).isEqualTo(1);
        assertThat(orderRepository.findById(competing.getId()).orElseThrow().getStatus())
                .isEqualTo("INSUFFICIENT_STOCK");
    }

    @Test
    void cancelReleasesReservationWithoutChangingPhysicalStock() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 3);
        Order order = readyToShipOrder(p, new BigDecimal("99.00"), 2);

        Order cancelled = orderCompletionService.cancel(order, "买家取消");
        Inventory after = inventoryRepository.findByProductId(p.getId()).orElseThrow();
        assertThat(cancelled.getStatus()).isEqualTo("CANCELLED");
        assertThat(cancelled.getReservedQuantity()).isZero();
        assertThat(after.getCurrentStock()).isEqualTo(3);
        assertThat(after.getReservedStock()).isZero();
    }

    @Test
    void shipmentConsumesReservationAndReturnRestoresPhysicalStock() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 3);
        Order order = readyToShipOrder(p, new BigDecimal("100.00"), 2);
        when(pythonAgentClient.shipOrder(any())).thenReturn(new PythonShipResult(true, "ok", ""));

        Order shipped = orderCompletionService.ship(order,
                new ShipRequest("顺丰速运", "SF-RETURN", BigDecimal.ZERO, "MANUAL"));
        Inventory afterShip = inventoryRepository.findByProductId(p.getId()).orElseThrow();
        assertThat(afterShip.getCurrentStock()).isEqualTo(1);
        assertThat(afterShip.getReservedStock()).isZero();

        Order refunded = orderCompletionService.refund(shipped, "质量问题退款");
        Order returned = orderCompletionService.confirmReturn(refunded, "仓库验收入库");
        Inventory afterReturn = inventoryRepository.findByProductId(p.getId()).orElseThrow();
        assertThat(returned.getStatus()).isEqualTo("RETURNED");
        assertThat(afterReturn.getCurrentStock()).isEqualTo(3);
    }

    @Test
    void pendingAfterSaleDoesNotPrematurelyMarkWholeOrderRefunded() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 2);
        Order order = readyToShipOrder(p, new BigDecimal("100.00"), 2);
        when(pythonAgentClient.shipOrder(any())).thenReturn(new PythonShipResult(true, "ok", ""));
        Order shipped = orderCompletionService.ship(order,
                new ShipRequest("顺丰速运", "SF-AS-PART", BigDecimal.ZERO, "MANUAL"));
        var first = afterSalesService.create(new AfterSalesRequest(
                shipped.getId(), "REFUND_ONLY", 1, new BigDecimal("50.00"), "第一件退款"));
        afterSalesService.create(new AfterSalesRequest(
                shipped.getId(), "REFUND_ONLY", 1, new BigDecimal("50.00"), "第二件待审"));

        afterSalesService.approveRefund(first.id());

        assertThat(orderRepository.findById(shipped.getId()).orElseThrow().getStatus()).isEqualTo("SHIPPED");
    }

    @Test
    void returnedGoodsRestoreCostInGrossProfit() {
        Product p = product(new BigDecimal("39.00"));
        inventory(p, 1);
        Order order = readyToShipOrder(p, new BigDecimal("100.00"), 1);
        when(pythonAgentClient.shipOrder(any())).thenReturn(new PythonShipResult(true, "ok", ""));
        Order shipped = orderCompletionService.ship(order,
                new ShipRequest("顺丰速运", "SF-AS-RETURN", BigDecimal.ZERO, "MANUAL"));
        var request = afterSalesService.create(new AfterSalesRequest(
                shipped.getId(), "RETURN_REFUND", 1, new BigDecimal("100.00"), "质量问题"));
        afterSalesService.approveRefund(request.id());
        afterSalesService.receiveReturn(request.id(), new ReturnReceiveRequest("RESTOCK", "验收合格"));

        Order returned = orderRepository.findById(shipped.getId()).orElseThrow();
        assertThat(returned.getStatus()).isEqualTo("RETURNED");
        assertThat(returned.getGrossProfit()).isEqualByComparingTo("0.00");
        assertThat(inventoryRepository.findByProductId(p.getId()).orElseThrow().getCurrentStock()).isEqualTo(1);
    }

    @Test
    void overdueEscalationUpdatesAllStatusFieldsAndAudit() {
        Product p = product(new BigDecimal("39.00"));
        Order order = new Order();
        order.setProduct(p);
        order.setPlatform("mock");
        order.setPlatformOrderId("MOCK-OVERDUE" + System.nanoTime());
        order.setQuantity(1);
        order.setStatus("PENDING_ANALYSIS");
        order.setAddressComplete(false);
        order.setPaid(false);
        order.setManualReviewRequired(false);
        order.setFulfillmentSuggestionStatus("PENDING_ANALYSIS");
        order.setPayment(BigDecimal.ZERO);
        order.setPostFee(BigDecimal.ZERO);
        order = orderRepository.save(order);

        Order escalated = orderCompletionService.escalateOverdue(order.getId(), 7);

        assertThat(escalated.getStatus()).isEqualTo("NEEDS_REVIEW");
        assertThat(escalated.getFulfillmentSuggestionStatus()).isEqualTo("NEEDS_REVIEW");
        assertThat(escalated.getManualReviewRequired()).isTrue();
        assertThat(auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
                "ORDER", order.getId())).extracting("action").contains("ESCALATE_OVERDUE");
    }
}
