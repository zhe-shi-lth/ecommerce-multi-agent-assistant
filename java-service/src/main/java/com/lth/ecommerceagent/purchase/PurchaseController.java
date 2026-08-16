package com.lth.ecommerceagent.purchase;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/purchase-orders")
public class PurchaseController {

    private final PurchaseService purchaseService;

    public PurchaseController(PurchaseService purchaseService) {
        this.purchaseService = purchaseService;
    }

    /** 发起采购申请（初始态 PENDING_APPROVAL=待审批）。 */
    @PostMapping
    @PreAuthorize("hasAuthority('PERM_PURCHASE_CREATE')")
    public PurchaseOrderResponse create(@RequestBody CreatePurchaseOrderRequest request) {
        return purchaseService.create(request);
    }

    /** 采购单列表，可按生命周期状态过滤（PENDING_APPROVAL/REJECTED/CREATED/ORDERED/INBOUND/STOCKED）。 */
    @GetMapping
    public List<PurchaseOrderResponse> list(@RequestParam(name = "status", required = false) String status) {
        return purchaseService.listByStatus(status);
    }

    @GetMapping("/{id}")
    public PurchaseOrderResponse get(@PathVariable Long id) {
        return purchaseService.listByStatus(null).stream()
                .filter(p -> p.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "采购单不存在：" + id));
    }

    /** 待审批 → 待采购。 */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('PERM_PURCHASE_APPROVE')")
    public PurchaseOrderResponse approve(@PathVariable Long id) {
        return purchaseService.approve(id);
    }

    /** 待审批 → 已驳回。 */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('PERM_PURCHASE_APPROVE')")
    public PurchaseOrderResponse reject(@PathVariable Long id) {
        return purchaseService.reject(id);
    }

    /** 待采购 → 已下单。 */
    @PostMapping("/{id}/mark-ordered")
    @PreAuthorize("hasAuthority('PERM_PURCHASE_CREATE')")
    public PurchaseOrderResponse markOrdered(@PathVariable Long id) {
        return purchaseService.markOrdered(id);
    }

    /** 已下单 → 待入库。 */
    @PostMapping("/{id}/mark-inbound")
    @PreAuthorize("hasAuthority('PERM_PURCHASE_CREATE')")
    public PurchaseOrderResponse markInbound(@PathVariable Long id) {
        return purchaseService.markInbound(id);
    }

    /** 待入库 → 已入库：增加库存并触发该商品缺货订单重新判定；可传实际到货数量与破损备注。 */
    @PostMapping("/{id}/stock-in")
    @PreAuthorize("hasAuthority('PERM_PURCHASE_RECEIVE')")
    public StockInResult stockIn(@PathVariable Long id, @RequestBody(required = false) StockInRequest request) {
        return purchaseService.stockIn(id, request);
    }

    @GetMapping("/{id}/receipts")
    public List<PurchaseReceiptResponse> receipts(@PathVariable Long id) {
        return purchaseService.receipts(id);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('PERM_PURCHASE_CREATE')")
    public PurchaseOrderResponse cancel(@PathVariable Long id, @RequestBody PurchaseActionRequest request) {
        return purchaseService.cancel(id, request.reason());
    }

    @PostMapping("/{id}/close-short")
    @PreAuthorize("hasAuthority('PERM_PURCHASE_RECEIVE')")
    public PurchaseOrderResponse closeShort(@PathVariable Long id, @RequestBody PurchaseActionRequest request) {
        return purchaseService.closeShort(id, request.reason());
    }
}

record PurchaseActionRequest(String reason) {}
