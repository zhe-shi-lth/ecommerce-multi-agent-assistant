package com.lth.ecommerceagent.purchase;

import java.math.BigDecimal;
import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
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

    public PurchaseService(
            PurchaseOrderRepository purchaseOrderRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            OrderCompletionService orderCompletionService,
            SupplierRepository supplierRepository) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderCompletionService = orderCompletionService;
        this.supplierRepository = supplierRepository;
    }

    @Transactional
    public PurchaseOrderResponse create(CreatePurchaseOrderRequest request) {
        if (request.productId() == null || request.quantity() == null || request.quantity() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "采购补货单需要有效的商品与数量");
        }
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "商品不存在：" + request.productId()));

        // 商家：优先取请求指定的，否则取商品的主供应商；最终落到快照字段，保证历史可读。
        Supplier supplier = null;
        if (request.supplierId() != null) {
            supplier = supplierRepository.findById(request.supplierId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "进货商家不存在：" + request.supplierId()));
        } else if (product.getSupplier() != null) {
            supplier = product.getSupplier();
        }

        PurchaseOrder po = new PurchaseOrder();
        po.setProduct(product);
        po.setQuantity(request.quantity());
        po.setSupplierRef(supplier);
        po.setSupplierName(supplier != null ? supplier.getName() : null);
        po.setNote(request.note());
        po.setStatus(PurchaseOrder.CREATED);

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
        // 实际入库数量第一版默认等于采购数量，字段先留出来供后续按真实到货填。
        int actualQuantity = quantity;
        BigDecimal productAmount = unitCost.multiply(BigDecimal.valueOf(quantity)).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal totalCost = productAmount.add(purchaseShippingFee).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal landedUnitCost = actualQuantity > 0
                ? totalCost.divide(BigDecimal.valueOf(actualQuantity), 2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        po.setUnitCost(unitCost);
        po.setPurchaseShippingFee(purchaseShippingFee);
        po.setActualQuantity(actualQuantity);
        po.setProductAmount(productAmount);
        po.setTotalCost(totalCost);
        po.setLandedUnitCost(landedUnitCost);
        po.setExpectedArrivalAt(request.expectedArrivalAt());

        return PurchaseOrderResponse.from(purchaseOrderRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse markOrdered(Long id) {
        PurchaseOrder po = find(id);
        requireStatus(po, PurchaseOrder.CREATED, "仅「待采购」采购单可以标记为已下单");
        po.setStatus(PurchaseOrder.ORDERED);
        po.setOrderedAt(Instant.now());
        return PurchaseOrderResponse.from(purchaseOrderRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse markInbound(Long id) {
        PurchaseOrder po = find(id);
        requireStatus(po, PurchaseOrder.ORDERED, "仅「已下单」采购单可以标记为待入库");
        po.setStatus(PurchaseOrder.INBOUND);
        po.setInboundAt(Instant.now());
        return PurchaseOrderResponse.from(purchaseOrderRepository.save(po));
    }

    /**
     * 确认入库：库存增加 + 触发该商品缺货订单重判。返回本单与重判统计（前端据此提示"翻回可发货 N 笔"）。
     * 支持实际入库数量：actualQuantity 缺省或非法时按采购数量；少发时按实际到货入库，并据总成本重算
     * 单件综合成本（landedUnitCost = totalCost / 实际到货），写回商品成本价。
     */
    @Transactional
    public StockInResult stockIn(Long id, StockInRequest request) {
        PurchaseOrder po = find(id);
        requireStatus(po, PurchaseOrder.INBOUND, "仅「待入库」采购单可以确认入库");

        // 实际入库数量（支持「买 100 到 98」）校验：
        // - 未传 → 默认按采购数量入库（不静默兜底为全量以外的任何值）；
        // - 传了但 <= 0 → 直接报错（避免接口误传 0 把库存错加全量）；
        // - 传了且 > 采购数量 → 直接报错（第一版不支持多到货/赠品/供应商多发）。
        Integer reqQty = (request != null) ? request.actualQuantity() : null;
        int actualQuantity;
        if (reqQty == null) {
            actualQuantity = po.getQuantity();
        } else if (reqQty <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "实际入库数量必须大于 0");
        } else if (reqQty > po.getQuantity()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "实际入库数量不能超过采购数量（暂不支持多到货/赠品）");
        } else {
            actualQuantity = reqQty;
        }
        // 入库时按实际到货重算单件综合成本（总成本固定，摊到实际到货上）。
        java.math.BigDecimal totalCost = po.getTotalCost() != null ? po.getTotalCost() : java.math.BigDecimal.ZERO;
        java.math.BigDecimal landedUnitCost = actualQuantity > 0
                ? totalCost.divide(java.math.BigDecimal.valueOf(actualQuantity), 2, java.math.RoundingMode.HALF_UP)
                : java.math.BigDecimal.ZERO;
        po.setActualQuantity(actualQuantity);
        po.setLandedUnitCost(landedUnitCost);
        if (request != null && request.note() != null) {
            po.setInboundNote(request.note());
        }

        // ① 库存增加并据水位重算状态。库存增量用实际入库数量。
        Inventory inventory = inventoryRepository.findByProductId(po.getProduct().getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "库存记录不存在：" + po.getProduct().getId()));
        int newStock = inventory.getCurrentStock() + actualQuantity;
        inventory.setCurrentStock(newStock);
        inventory.setInventoryStatus(recomputeStatus(newStock, inventory.getSafeStockThreshold()));
        inventoryRepository.save(inventory);

        // ② 置入库态。
        po.setStatus(PurchaseOrder.STOCKED);
        po.setStockedAt(Instant.now());
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

        return new StockInResult(PurchaseOrderResponse.from(saved), recheck);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public java.util.List<PurchaseOrderResponse> listByStatus(String status) {
        java.util.List<PurchaseOrder> list = (status == null || status.isBlank())
                ? purchaseOrderRepository.findAll()
                : purchaseOrderRepository.findByStatus(status);
        return list.stream().map(PurchaseOrderResponse::from).toList();
    }

    private PurchaseOrder find(Long id) {
        return purchaseOrderRepository.findById(id)
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
