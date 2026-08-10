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

    private Order readyToShipOrder(Product p, BigDecimal payment, int qty) {
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
        return orderRepository.save(o);
    }

    // ===== 采购成本校验 =====

    @Test
    void createRejectsMissingUnitCost() {
        Product p = product(new BigDecimal("39.00"));
        CreatePurchaseOrderRequest req =
                new CreatePurchaseOrderRequest(p.getId(), 10, null, null, null, null, null);
        assertThatThrownBy(() -> purchaseService.create(req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void createRejectsZeroUnitCost() {
        Product p = product(new BigDecimal("39.00"));
        CreatePurchaseOrderRequest req =
                new CreatePurchaseOrderRequest(p.getId(), 10, null, BigDecimal.ZERO, BigDecimal.ZERO, null, null);
        assertThatThrownBy(() -> purchaseService.create(req))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void createComputesCosts() {
        Product p = product(new BigDecimal("39.00"));
        CreatePurchaseOrderRequest req = new CreatePurchaseOrderRequest(
                p.getId(), 10, null, new BigDecimal("10.00"), new BigDecimal("20.00"), null, null);
        var po = purchaseService.create(req);

        assertThat(po.productAmount()).isEqualByComparingTo("100.00"); // 10 * 10
        assertThat(po.totalCost()).isEqualByComparingTo("120.00"); // 100 + 20
        assertThat(po.landedUnitCost()).isEqualByComparingTo("12.00"); // 120 / 10
        assertThat(po.actualQuantity()).isEqualTo(10);
    }

    // ===== 入库数量校验 =====

    private Long toInbound(Product p, int qty) {
        var po = purchaseService.create(new CreatePurchaseOrderRequest(
                p.getId(), qty, null, new BigDecimal("10.00"), BigDecimal.ZERO, null, null));
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
    void stockInRejectsOverPurchase() {
        Product p = product(new BigDecimal("39.00"));
        Long poId = toInbound(p, 10);
        assertThatThrownBy(() -> purchaseService.stockIn(poId, new StockInRequest(11, null)))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void stockInWithPartialActualUpdatesCostAndStock() {
        Product p = product(new BigDecimal("39.00"));
        Inventory inv = inventory(p, 0);
        // 采购 10 件，单价 10，运费 0 -> 总成本 100；实际到货 8 -> 单件落地成本 12.50
        Long poId = toInbound(p, 10);
        purchaseService.stockIn(poId, new StockInRequest(8, "少发2件"));

        Inventory after = inventoryRepository.findByProductId(p.getId()).orElseThrow();
        assertThat(after.getCurrentStock()).isEqualTo(8);

        Product afterP = productRepository.findById(p.getId()).orElseThrow();
        assertThat(afterP.getCostPrice()).isEqualByComparingTo("12.50"); // 100 / 8
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
    }
}
