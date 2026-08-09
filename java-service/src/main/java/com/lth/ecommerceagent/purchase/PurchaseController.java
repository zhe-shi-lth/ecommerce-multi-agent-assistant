package com.lth.ecommerceagent.purchase;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/purchase-orders")
public class PurchaseController {

    private final PurchaseService purchaseService;

    public PurchaseController(PurchaseService purchaseService) {
        this.purchaseService = purchaseService;
    }

    /** 由「待确认补货建议」确认生成采购单（初始态 CREATED=待采购）。 */
    @PostMapping
    public PurchaseOrderResponse create(@RequestBody CreatePurchaseOrderRequest request) {
        return purchaseService.create(request);
    }

    /** 采购单列表，可按生命周期状态过滤（CREATED/ORDERED/INBOUND/STOCKED）。 */
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

    /** 待采购 → 已下单。 */
    @PostMapping("/{id}/mark-ordered")
    public PurchaseOrderResponse markOrdered(@PathVariable Long id) {
        return purchaseService.markOrdered(id);
    }

    /** 已下单 → 待入库。 */
    @PostMapping("/{id}/mark-inbound")
    public PurchaseOrderResponse markInbound(@PathVariable Long id) {
        return purchaseService.markInbound(id);
    }

    /** 待入库 → 已入库：增加库存并触发该商品缺货订单重新判定。 */
    @PostMapping("/{id}/stock-in")
    public StockInResult stockIn(@PathVariable Long id) {
        return purchaseService.stockIn(id);
    }
}
