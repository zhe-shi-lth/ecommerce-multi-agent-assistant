package com.lth.ecommerceagent.purchase;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.inventory.InventoryMovementService;
import com.lth.ecommerceagent.audit.BusinessAuditService;
import com.lth.ecommerceagent.order.OrderCompletionService;
import com.lth.ecommerceagent.order.RecheckAllResult;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.supplier.Supplier;
import com.lth.ecommerceagent.supplier.SupplierRepository;

/**
 * 采购补货（线2 库存处理工作台）的业务闭环。
 *
 * <p>生命周期：CREATED(待采购) → ORDERED(已下单) → INBOUND(待入库) → STOCKED(已入库)。
 * 入库(STOCKED)时：① 把采购数量加回对应商品库存并据水位重算库存状态；② 触发该商品缺货订单的
 * 重新判定（OrderCompletionService.recheckProduct）——翻成可发货的订单会真实从新增库存中拿货，
 * 与「缺货订单状态刷新」同一套账目逻辑，避免重复扣减。
 */
@Service
public class PurchaseService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderCompletionService orderCompletionService;
    private final SupplierRepository supplierRepository;
    private final BusinessAuditService auditService;
    private final InventoryMovementService movementService;
    private final PurchaseReceiptRepository receiptRepository;

    public PurchaseService(
            PurchaseOrderRepository purchaseOrderRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            OrderCompletionService orderCompletionService,
            SupplierRepository supplierRepository,
            BusinessAuditService auditService,
            InventoryMovementService movementService,
            PurchaseReceiptRepository receiptRepository) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderCompletionService = orderCompletionService;
        this.supplierRepository = supplierRepository;
        this.auditService = auditService;
        this.movementService = movementService;
        this.receiptRepository = receiptRepository;
    }

    @Transactional
    public PurchaseOrderResponse create(CreatePurchaseOrderRequest request) {
        if (request.productId() == null || request.quantity() == null || request.quantity() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "采购补货单需要有效的商品与数量");
        }
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "商品不存在：" + request.productId()));

        if (request.supplierId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "采购申请必须选择进货商家");
        }
        Supplier supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "进货商家不存在：" + request.supplierId()));
        if (supplier.getStatus() != Supplier.Status.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该进货商家已停用，请选择合作中的商家");
        }

        PurchaseOrder po = new PurchaseOrder();
        po.setProduct(product);
        po.setQuantity(request.quantity());
        po.setSupplierRef(supplier);
        po.setSupplierName(supplier != null ? supplier.getName() : null);
        po.setNote(request.note());
        po.setStatus(PurchaseOrder.PENDING_APPROVAL);

        // 成本核算（成本闭环）：商品金额 / 总成本 / 单件综合成本自动算，与订单发货运费严格区分。
        // 第一版采用「最近入库成本」策略：入库后再把 landedUnitCost 写回商品 cost_price（见 stockIn）。
        // 业务校验：进货单价必填且 > 0（成本闭环要求真实成本，不允许 0 成本入库），进货运费不可为负。
        if (request.unitCost() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "进货单价必填");
        }
        if (request.unitCost().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "进货单价必须大于 0");
        }
        BigDecimal unitCost = request.unitCost();
        BigDecimal purchaseShippingFee =
                (request.purchaseShippingFee() != null) ? request.purchaseShippingFee() : BigDecimal.ZERO;
        if (purchaseShippingFee.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "进货运费不能为负");
        }
        int quantity = request.quantity();
        BigDecimal productAmount = unitCost.multiply(BigDecimal.valueOf(quantity)).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal totalCost = productAmount.add(purchaseShippingFee).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal landedUnitCost = totalCost.divide(BigDecimal.valueOf(quantity), 2, java.math.RoundingMode.HALF_UP);
        po.setUnitCost(unitCost);
        po.setPurchaseShippingFee(purchaseShippingFee);
        po.setActualQuantity(0);
        po.setReceivedQuantity(0);
        po.setProductAmount(productAmount);
        po.setTotalCost(totalCost);
        po.setLandedUnitCost(landedUnitCost);
        po.setExpectedArrivalAt(request.expectedArrivalAt());

        PurchaseOrder saved = purchaseOrderRepository.save(po);
        auditService.record("PURCHASE", "PURCHASE_ORDER", saved.getId(), "CREATE_REQUEST",
                null, saved.getStatus(), "采购申请已创建，数量：" + saved.getQuantity());
        return PurchaseOrderResponse.from(saved);
    }

    @Transactional
    public PurchaseOrderResponse approve(Long id) {
        PurchaseOrder po = findForUpdate(id);
        requireStatus(po, PurchaseOrder.PENDING_APPROVAL, "仅「待审批」采购申请可以审批通过");
        po.setStatus(PurchaseOrder.CREATED);
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        auditService.record("PURCHASE", "PURCHASE_ORDER", id, "APPROVE",
                PurchaseOrder.PENDING_APPROVAL, saved.getStatus(), "采购申请审批通过");
        return PurchaseOrderResponse.from(saved);
    }

    @Transactional
    public PurchaseOrderResponse reject(Long id) {
        PurchaseOrder po = findForUpdate(id);
        requireStatus(po, PurchaseOrder.PENDING_APPROVAL, "仅「待审批」采购申请可以驳回");
        po.setStatus(PurchaseOrder.REJECTED);
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        auditService.record("PURCHASE", "PURCHASE_ORDER", id, "REJECT",
                PurchaseOrder.PENDING_APPROVAL, saved.getStatus(), "采购申请已驳回");
        return PurchaseOrderResponse.from(saved);
    }

    @Transactional
    public PurchaseOrderResponse markOrdered(Long id) {
        PurchaseOrder po = findForUpdate(id);
        if (PurchaseOrder.ORDERED.equals(po.getStatus())) return PurchaseOrderResponse.from(po);
        requireStatus(po, PurchaseOrder.CREATED, "仅「待采购」采购单可以标记为已下单");
        po.setStatus(PurchaseOrder.ORDERED);
        po.setOrderedAt(Instant.now());
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        auditService.record("PURCHASE", "PURCHASE_ORDER", id, "MARK_ORDERED",
                PurchaseOrder.CREATED, saved.getStatus(), "已向供应商下单");
        return PurchaseOrderResponse.from(saved);
    }

    @Transactional
    public PurchaseOrderResponse markInbound(Long id) {
        PurchaseOrder po = findForUpdate(id);
        if (PurchaseOrder.INBOUND.equals(po.getStatus()) || "PARTIALLY_RECEIVED".equals(po.getStatus())) return PurchaseOrderResponse.from(po);
        requireStatus(po, PurchaseOrder.ORDERED, "仅「已下单」采购单可以标记为待入库");
        po.setStatus(PurchaseOrder.INBOUND);
        po.setInboundAt(Instant.now());
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        auditService.record("PURCHASE", "PURCHASE_ORDER", id, "MARK_INBOUND",
                PurchaseOrder.ORDERED, saved.getStatus(), "采购单进入待入库");
        return PurchaseOrderResponse.from(saved);
    }

    /**
     * 确认入库：库存增加 + 触发该商品缺货订单重判。返回本单与重判统计（前端据此提示"翻回可发货 N 笔"）。
     * 支持实际入库数量：actualQuantity 缺省或非法时按采购数量；少发按实际到货入库，多发/赠品也照常入库，
     * 均据总成本重算单件综合成本（landedUnitCost = totalCost / 实际到货），写回商品成本价。
     */
    @Transactional
    public StockInResult stockIn(Long id, StockInRequest request) {
        String receiptNo = request != null && request.receiptNo() != null && !request.receiptNo().isBlank()
                ? request.receiptNo().trim() : "PR-" + UUID.randomUUID();
        PurchaseReceipt existing = receiptRepository.findByReceiptNo(receiptNo).orElse(null);
        if (existing != null) {
            if (!existing.getPurchaseOrder().getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "到货批次号已用于其他采购单");
            }
            PurchaseOrder existingOrder = find(existing.getPurchaseOrder().getId());
            return new StockInResult(PurchaseOrderResponse.from(existingOrder), new RecheckAllResult(0, 0, 0, 0));
        }
        PurchaseOrder po = findForUpdate(id);
        existing = receiptRepository.findByReceiptNo(receiptNo).orElse(null);
        if (existing != null) {
            if (!existing.getPurchaseOrder().getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "到货批次号已用于其他采购单");
            }
            return new StockInResult(PurchaseOrderResponse.from(po), new RecheckAllResult(0, 0, 0, 0));
        }
        if (!PurchaseOrder.INBOUND.equals(po.getStatus()) && !"PARTIALLY_RECEIVED".equals(po.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅待入库或部分到货采购单可以确认入库");
        }

        // 实际入库数量（支持「买 100 到 98」，也支持「买 100 到 105」供应商多发/赠品）校验：
        // - 未传 → 默认按剩余未到货数量入库；
        // - 传了但 <= 0 → 直接报错（避免接口误传 0 把库存错加全量）；
        // - 传了且 > 采购数量 → 允许，多到部分照常入库，单件成本被摊低（前端会二次确认）。
        int receivedBefore = po.getReceivedQuantity() == null ? 0 : po.getReceivedQuantity();
        int remaining = Math.max(0, po.getQuantity() - receivedBefore);
        Integer reqQty = (request != null) ? request.actualQuantity() : null;
        int actualQuantity;
        if (reqQty == null) {
            actualQuantity = remaining;
        } else if (reqQty <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "实际入库数量必须大于 0");
        } else {
            // 支持供应商多发 / 赠品：实际入库可大于采购数量，多到部分一并入库，
            // 单件综合成本 = 总成本 ÷ 实际入库数量（被摊低），写回商品成本价。
            actualQuantity = reqQty;
        }
        java.math.BigDecimal totalCost = po.getTotalCost() != null ? po.getTotalCost() : java.math.BigDecimal.ZERO;
        int receivedTotal = receivedBefore + actualQuantity;
        po.setActualQuantity(receivedTotal);
        po.setReceivedQuantity(receivedTotal);
        int costDivisor = receivedTotal >= po.getQuantity() ? receivedTotal : po.getQuantity();
        java.math.BigDecimal landedUnitCost = totalCost.divide(
                java.math.BigDecimal.valueOf(costDivisor), 2, java.math.RoundingMode.HALF_UP);
        po.setLandedUnitCost(landedUnitCost);
        if (request != null && request.note() != null) {
            po.setInboundNote(request.note());
        }

        // ① 库存增加并据水位重算状态。库存增量用实际入库数量。
        Inventory inventory = inventoryRepository.findByProductId(po.getProduct().getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "库存记录不存在：" + po.getProduct().getId()));
        if (inventoryRepository.incrementStock(po.getProduct().getId(), actualQuantity) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "库存记录不存在，无法入库");
        }
        movementService.record(po.getProduct().getId(), "PURCHASE_STOCK_IN",
                actualQuantity, 0, "PURCHASE_ORDER", po.getId(), "采购入库：" + actualQuantity);

        PurchaseReceipt receipt = new PurchaseReceipt();
        receipt.setPurchaseOrder(po);
        receipt.setReceiptNo(receiptNo);
        receipt.setQuantity(actualQuantity);
        receipt.setNote(request != null ? request.note() : null);
        receipt.setReceivedAt(Instant.now());
        var auth = SecurityContextHolder.getContext().getAuthentication();
        receipt.setOperator(auth != null && auth.isAuthenticated() ? auth.getName() : "SYSTEM");
        receiptRepository.save(receipt);

        // ② 置入库态。
        boolean completed = receivedTotal >= po.getQuantity();
        po.setStatus(completed ? PurchaseOrder.STOCKED : "PARTIALLY_RECEIVED");
        if (completed) po.setStockedAt(Instant.now());
        PurchaseOrder saved = purchaseOrderRepository.save(po);

        // ②-b 成本闭环（第一版「最近入库成本」策略）：把本次单件综合成本写回商品当前成本价。
        // 后续可升级为移动加权平均，但先用最近入库成本，更直观、易调。
        if (po.getLandedUnitCost() != null) {
            Product product = po.getProduct();
            product.setCostPrice(po.getLandedUnitCost());
            productRepository.save(product);
        }

        // ③ 触发该商品缺货订单重新判定（翻成可发货的订单真实扣减新增库存）。
        RecheckAllResult recheck = orderCompletionService.recheckProduct(po.getProduct().getId());

        auditService.record("PURCHASE", "PURCHASE_ORDER", id, "STOCK_IN",
                receivedBefore == 0 ? PurchaseOrder.INBOUND : "PARTIALLY_RECEIVED", saved.getStatus(),
                "批次 " + receiptNo + " 入库：" + actualQuantity + "，累计：" + receivedTotal + "，转为可发货订单：" + recheck.getReadyToShip());

        return new StockInResult(PurchaseOrderResponse.from(saved), recheck);
    }

    @Transactional
    public PurchaseOrderResponse cancel(Long id, String reason) {
        PurchaseOrder po = findForUpdate(id);
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "必须填写取消原因");
        }
        if (!java.util.Set.of(PurchaseOrder.PENDING_APPROVAL, PurchaseOrder.CREATED,
                PurchaseOrder.ORDERED, PurchaseOrder.INBOUND).contains(po.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前采购单不能取消（当前：" + po.getStatus() + "）");
        }
        if (po.getReceivedQuantity() != null && po.getReceivedQuantity() > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已有到货记录的采购单不能取消，请使用短交关闭");
        }
        String before = po.getStatus();
        po.setStatus(PurchaseOrder.CANCELLED);
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        auditService.record("PURCHASE", "PURCHASE_ORDER", id, "CANCEL", before,
                saved.getStatus(), reason.trim());
        return PurchaseOrderResponse.from(saved);
    }

    @Transactional
    public PurchaseOrderResponse closeShort(Long id, String reason) {
        PurchaseOrder po = findForUpdate(id);
        requireStatus(po, PurchaseOrder.PARTIALLY_RECEIVED, "仅部分到货采购单可以短交关闭");
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "必须填写短交关闭原因");
        }
        int received = po.getReceivedQuantity() == null ? 0 : po.getReceivedQuantity();
        if (received <= 0 || received >= po.getQuantity()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "采购单没有可关闭的短交数量");
        }
        BigDecimal productAmount = po.getUnitCost().multiply(BigDecimal.valueOf(received))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal shipping = po.getPurchaseShippingFee() == null ? BigDecimal.ZERO : po.getPurchaseShippingFee();
        BigDecimal total = productAmount.add(shipping).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal landed = total.divide(BigDecimal.valueOf(received), 2, java.math.RoundingMode.HALF_UP);
        po.setProductAmount(productAmount);
        po.setTotalCost(total);
        po.setLandedUnitCost(landed);
        po.setInboundNote(reason.trim());
        po.setStatus(PurchaseOrder.CLOSED_SHORT);
        po.setStockedAt(Instant.now());
        Product product = po.getProduct();
        product.setCostPrice(landed);
        productRepository.save(product);
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        auditService.record("PURCHASE", "PURCHASE_ORDER", id, "CLOSE_SHORT",
                PurchaseOrder.PARTIALLY_RECEIVED, saved.getStatus(),
                "实收 " + received + " / 采购 " + po.getQuantity() + "；" + reason.trim());
        return PurchaseOrderResponse.from(saved);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public java.util.List<PurchaseOrderResponse> listByStatus(String status) {
        java.util.List<PurchaseOrder> list = (status == null || status.isBlank())
                ? purchaseOrderRepository.findAll()
                : purchaseOrderRepository.findByStatus(status);
        return list.stream().map(PurchaseOrderResponse::from).toList();
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public java.util.List<PurchaseReceiptResponse> receipts(Long id) {
        find(id);
        return receiptRepository.findByPurchaseOrderIdOrderByReceivedAtAsc(id).stream()
                .map(PurchaseReceiptResponse::from).toList();
    }

    private PurchaseOrder find(Long id) {
        return purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "采购单不存在：" + id));
    }

    private PurchaseOrder findForUpdate(Long id) {
        return purchaseOrderRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "采购单不存在：" + id));
    }

    private void requireStatus(PurchaseOrder po, String expected, String msg) {
        if (!expected.equals(po.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, msg + "（当前：" + po.getStatus() + "）");
        }
    }

    /** 据当前库存与警戒水位重算库存状态（RISK/LOW/ENOUGH），与 SimulationService / OrderCompletionService 同口径。 */
    private String recomputeStatus(int currentStock, int safeThreshold) {
        if (currentStock < safeThreshold) {
            return "RISK";
        }
        if (currentStock < safeThreshold * 2) {
            return "LOW";
        }
        return "ENOUGH";
    }
}
