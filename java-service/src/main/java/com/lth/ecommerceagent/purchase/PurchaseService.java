package com.lth.ecommerceagent.purchase;

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

    public PurchaseService(
            PurchaseOrderRepository purchaseOrderRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            OrderCompletionService orderCompletionService) {
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderCompletionService = orderCompletionService;
    }

    @Transactional
    public PurchaseOrderResponse create(CreatePurchaseOrderRequest request) {
        if (request.productId() == null || request.quantity() == null || request.quantity() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "采购补货单需要有效的商品与数量");
        }
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "商品不存在：" + request.productId()));
        PurchaseOrder po = new PurchaseOrder();
        po.setProduct(product);
        po.setQuantity(request.quantity());
        po.setSupplier(request.supplier());
        po.setNote(request.note());
        po.setStatus(PurchaseOrder.CREATED);
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
     */
    @Transactional
    public StockInResult stockIn(Long id) {
        PurchaseOrder po = find(id);
        requireStatus(po, PurchaseOrder.INBOUND, "仅「待入库」采购单可以确认入库");

        // ① 库存增加并据水位重算状态。
        Inventory inventory = inventoryRepository.findByProductId(po.getProduct().getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "库存记录不存在：" + po.getProduct().getId()));
        int newStock = inventory.getCurrentStock() + po.getQuantity();
        inventory.setCurrentStock(newStock);
        inventory.setInventoryStatus(recomputeStatus(newStock, inventory.getSafeStockThreshold()));
        inventoryRepository.save(inventory);

        // ② 置入库态。
        po.setStatus(PurchaseOrder.STOCKED);
        po.setStockedAt(Instant.now());
        PurchaseOrder saved = purchaseOrderRepository.save(po);

        // ③ 触发该商品缺货订单重新判定（翻成可发货的订单真实扣减新增库存）。
        RecheckAllResult recheck = orderCompletionService.recheckProduct(po.getProduct().getId());

        return new StockInResult(PurchaseOrderResponse.from(saved), recheck);
    }

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
