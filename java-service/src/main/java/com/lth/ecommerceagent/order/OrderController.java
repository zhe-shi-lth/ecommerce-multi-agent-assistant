package com.lth.ecommerceagent.order;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonOrderVerifyRequest;
import com.lth.ecommerceagent.python.PythonOrderVerifyResult;
import com.lth.ecommerceagent.python.PythonPaymentVerifyResult;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    // 手工建单时的单号自增序号（配合毫秒时间戳保证唯一）
    private static final java.util.concurrent.atomic.AtomicLong MANUAL_SEQ = new java.util.concurrent.atomic.AtomicLong();

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final PythonAgentClient pythonAgentClient;
    private final OrderCompletionService orderCompletionService;

    public OrderController(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            PythonAgentClient pythonAgentClient,
            OrderCompletionService orderCompletionService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.pythonAgentClient = pythonAgentClient;
        this.orderCompletionService = orderCompletionService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> create(@RequestBody OrderCreateRequest request) {
        Product product = findProduct(request.productId());
        Order order = new Order();
        apply(request, product, order);
        // 平台单号不可为空：调用方没给就生成一个，保证与拉单来源的数据形状一致。
        String platformOrderId = (request.platformOrderId() != null && !request.platformOrderId().isBlank())
                ? request.platformOrderId().trim()
                : "MANUAL" + System.currentTimeMillis() + String.format("%06d", MANUAL_SEQ.incrementAndGet());
        order.setPlatformOrderId(platformOrderId);
        Order saved = orderRepository.save(order);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public List<OrderResponse> list() {
        return orderRepository.findAll().stream().map(this::toResponse).toList();
    }

    /**
     * 库存不足订单按商品汇总（销售监控「库存不足订单」警告板块）。
     * 仅统计 INSUFFICIENT_STOCK 订单，回填各商品当前库存与缺口（shortQuantity = max(0, 积压 − 当前库存)）。
     * 无此类订单时返回空数组，前端据此隐藏警告板块。
     */
    @GetMapping("/insufficient-summary")
    public List<InsufficientStockSummary> insufficientSummary() {
        List<InsufficientStockSummary> list = orderRepository.summarizeInsufficientStock();
        for (InsufficientStockSummary s : list) {
            inventoryRepository.findByProductId(s.getProductId()).ifPresent(inv -> {
                int cur = inv.getCurrentStock();
                s.setCurrentStock(cur);
                s.setShortQuantity(Math.max(0, (int) s.getBacklogQuantity() - cur));
            });
        }
        return list;
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return toResponse(findOrder(id));
    }

    @GetMapping("/by-product/{productId}")
    public OrderResponse getByProduct(@PathVariable Long productId) {
        Order order = orderRepository.findByProductId(productId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Order not found for product: " + productId));
        return toResponse(order);
    }

    @PutMapping("/{id}")
    public OrderResponse update(@PathVariable Long id, @RequestBody OrderCreateRequest request) {
        Order order = findOrder(id);
        Product product = findProduct(request.productId());
        apply(request, product, order);
        return toResponse(orderRepository.save(order));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Order order = findOrder(id);
        orderRepository.delete(order);
        return ResponseEntity.noContent().build();
    }

    /**
     * 地址补全闭环：商家在后台「确认地址已补全」后调用。
     * 1. 监控 Agent 复核：先向订单来源确认地址是否真已补全（演示态=随机模拟平台同步；生产态=平台 address_complete）；
     *    仍不完整 → 直接 409 拒绝（前端弹窗），不翻转布尔、不改状态。
     * 2. 复核通过 → 置 addressComplete=true；3. 调 Python 按「地址已完整」重算履约结论；
     * 4. 回写 fulfillmentPlanJson，并同时流转 orders.status 与 fulfillmentSuggestionStatus
     *    （canShip→READY_TO_SHIP；仍缺库存→INSUFFICIENT_STOCK；其余→NEEDS_REVIEW），
     *    使订单主状态在补全后真正变化，而非创建后一成不变。
     */
    @PostMapping("/{id}/complete-address")
    public OrderResponse completeAddress(@PathVariable Long id) {
        Order order = findOrder(id);

        // 监控 Agent 复核（订单维度，由 Python OrderMonitorAgent 负责）：先向订单来源确认地址是否真已补全。
        // 失败直接拦截（409 + 可读原因），不翻转布尔、不改状态；不盲目信任人工操作。
        PythonOrderVerifyResult check = pythonAgentClient.verifyOrder(PythonOrderVerifyRequest.from(order));
        if (Boolean.FALSE.equals(check.verified())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, check.reason());
        }

        Order saved = orderCompletionService.markAddressComplete(order);
        return toResponse(saved);
    }

    /**
     * 付款闭环：商家在后台「确认已付款」后调用，对称 complete-address。
     * 1. 监控 Agent 复核：先向订单来源确认买家是否已付款（演示态=随机模拟平台同步；生产态=平台 paid）；
     *    仍未付款 → 直接 409 拒绝（前端弹窗），不翻转布尔、不改状态。
     * 2. 复核通过 → 置 paid=true；3. 调 Python 按「已付款」重算履约结论；
     * 4. 回写 fulfillmentPlanJson，并同时流转 orders.status 与 fulfillmentSuggestionStatus
     *    （地址仍不全→PENDING_ANALYSIS；其余→READY_TO_SHIP / INSUFFICIENT_STOCK / NEEDS_REVIEW），
     *    使订单主状态在付款后真正变化，而非创建后一成不变。
     */
    @PostMapping("/{id}/mark-paid")
    public OrderResponse markPaid(@PathVariable Long id) {
        Order order = findOrder(id);

        // 监控 Agent 复核（订单维度）：先向订单来源确认买家是否已付款。
        // 失败直接拦截（409 + 可读原因），不翻转布尔、不改状态；不盲目信任人工操作。
        PythonPaymentVerifyResult check = pythonAgentClient.verifyPayment(PythonOrderVerifyRequest.from(order));
        if (Boolean.FALSE.equals(check.verified())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, check.reason());
        }

        Order saved = orderCompletionService.markPaid(order);
        return toResponse(saved);
    }

    /**
     * 发货闭环终态：商家在后台「发货」后调用，仅「可发货(READY_TO_SHIP)」可发货。
     * 非 READY_TO_SHIP → 409 拒绝（如 INSUFFICIENT_STOCK / NEEDS_REVIEW / 仍待处理 必须先解决）。
     * 通过 → 置 SHIPPED + 发货时间；物流缺失时由后端模拟生成（接真实平台后由平台返回）。
     */
    @PostMapping("/{id}/ship")
    public OrderResponse ship(@PathVariable Long id) {
        Order order = findOrder(id);
        if (!"READY_TO_SHIP".equals(order.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "仅「可发货」订单可以发货，当前状态：" + order.getStatus());
        }
        Order saved = orderCompletionService.ship(order);
        return toResponse(saved);
    }

    /**
     * 人工审核决议：商家在后台对 NEEDS_REVIEW 订单「通过 / 驳回」。
     * 非 NEEDS_REVIEW → 409 拒绝（待分析/可发货/已发货/已驳回都无需审核）。
     * 通过 → 按事实重算履约结论；驳回 → 置 REJECTED（终态，线下取消/退款）。
     */
    @PostMapping("/{id}/review")
    public OrderResponse review(@PathVariable Long id, @RequestBody OrderReviewRequest request) {
        Order order = findOrder(id);
        if (!"NEEDS_REVIEW".equals(order.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "仅「需人工审核」订单可以审核，当前状态：" + order.getStatus());
        }
        if (!request.isApprove() && !request.isReject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "decision 仅支持 APPROVE / REJECT");
        }
        Order saved = orderCompletionService.review(order, request.isApprove());
        return toResponse(saved);
    }

    /**
     * 库存补足后「重新判定」：仅「库存不足(INSUFFICIENT_STOCK)」订单可触发，手动闭环最后一步。
     * 非 INSUFFICIENT_STOCK → 409 拒绝；库存仍不足 → 409 拒绝并提示缺口；
     * 库存充足 → 按事实重算履约结论（已付款∧地址完整→READY_TO_SHIP，否则回到待分析/审核）。
     */
    @PostMapping("/{id}/recheck")
    public OrderResponse recheck(@PathVariable Long id) {
        Order order = findOrder(id);
        if (!"INSUFFICIENT_STOCK".equals(order.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "仅「库存不足」订单可以重新判定库存，当前状态：" + order.getStatus());
        }
        Order saved = orderCompletionService.recheckStock(order);
        return toResponse(saved);
    }

    /**
     * 批量「重新判定」所有库存不足订单（订单 tab 顶部按钮）：补货完成后按当前库存重算状态，不改动库存。
     * 返回统计（翻回可发货 / 仍不足 / 其他态笔数），前端据此提示。无此类订单时返回 total=0。
     */
    @PostMapping("/recheck-all")
    public RecheckAllResult recheckAll() {
        return orderCompletionService.recheckAllInsufficient();
    }

    /**
     * 单商品「重新判定」（销售监控「库存不足订单」对应位置按钮）：补货完成后重算该商品库存不足订单的状态，不改动库存。
     */
    @PostMapping("/recheck/{productId}")
    public RecheckAllResult recheckProduct(@PathVariable Long productId) {
        return orderCompletionService.recheckProduct(productId);
    }

    private void apply(OrderCreateRequest request, Product product, Order order) {
        order.setProduct(product);
        if (request.platform() != null && !request.platform().isBlank()) {
            order.setPlatform(request.platform());
        }
        order.setQuantity(request.quantity());
        order.setStatus(request.status());
        order.setAddressComplete(request.addressComplete());
        order.setPaid(request.paid());
        order.setManualReviewRequired(request.manualReviewRequired());
        order.setFulfillmentSuggestionStatus(request.fulfillmentSuggestionStatus());
        // 待处理原因在待分析态才有意义：依据付款/地址/状态推导；离开待分析由流转逻辑清空。
        order.setPendingReason(Order.computePendingReason(request.paid(), request.addressComplete(), request.status()));
        order.setReceiverName(request.receiverName());
        order.setReceiverPhone(request.receiverPhone());
        order.setReceiverProvince(request.receiverProvince());
        order.setReceiverCity(request.receiverCity());
        order.setReceiverDistrict(request.receiverDistrict());
        order.setReceiverDetail(request.receiverDetail());
        order.setBuyerNick(request.buyerNick());
        if (request.payment() != null) order.setPayment(request.payment());
        if (request.postFee() != null) order.setPostFee(request.postFee());
        order.setLogisticsCompany(request.logisticsCompany());
        order.setWaybillNo(request.waybillNo());
        order.setEncrypted(request.encrypted() != null && request.encrypted());
    }

    private Product findProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product not found: " + id));
    }

    private Order findOrder(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found: " + id));
    }

    private OrderResponse toResponse(Order o) {
        return new OrderResponse(
                o.getId(),
                o.getProduct().getId(),
                o.getPlatform(),
                o.getPlatformOrderId(),
                o.getQuantity(),
                o.getStatus(),
                o.getAddressComplete(),
                o.getPaid(),
                o.getManualReviewRequired(),
                o.getFulfillmentSuggestionStatus(),
                o.getPendingReason(),
                o.getFulfillmentPlanJson(),
                o.getReceiverName(),
                o.getReceiverPhone(),
                o.getReceiverProvince(),
                o.getReceiverCity(),
                o.getReceiverDistrict(),
                o.getReceiverDetail(),
                o.getBuyerNick(),
                o.getPayment(),
                o.getPostFee(),
                o.getLogisticsCompany(),
                o.getWaybillNo(),
                o.getEncrypted(),
                o.getShippedAt(),
                o.getCreatedAt(),
                o.getUpdatedAt());
    }
}
