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
import com.lth.ecommerceagent.python.PythonFulfillmentResult;
import com.lth.ecommerceagent.python.PythonOrderFulfillmentRequest;
import com.lth.ecommerceagent.python.PythonOrderVerifyRequest;
import com.lth.ecommerceagent.python.PythonOrderVerifyResult;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    // 手工建单时的单号自增序号（配合毫秒时间戳保证唯一）
    private static final java.util.concurrent.atomic.AtomicLong MANUAL_SEQ = new java.util.concurrent.atomic.AtomicLong();

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final PythonAgentClient pythonAgentClient;

    public OrderController(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            PythonAgentClient pythonAgentClient) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.pythonAgentClient = pythonAgentClient;
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

        order.setAddressComplete(true);

        Inventory inventory = inventoryRepository.findByProductId(order.getProduct().getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Inventory not found for product: " + order.getProduct().getId()));

        PythonOrderFulfillmentRequest request = PythonOrderFulfillmentRequest.from(order, inventory);
        PythonFulfillmentResult result = pythonAgentClient.callOrderFulfillment(request);

        // Python 的 next_order_status 可能由 LLM 生成，不保证落在 orders 表的 CHECK 枚举内；
        // 这里收敛为合法枚举后再落库，避免违反 ck_orders_* 的 CHECK 约束。
        // 同时把同一结论写到订单主状态 status，使其随补全真正流转。
        String resolved = toSuggestionStatus(result, order);
        order.setFulfillmentSuggestionStatus(resolved);
        order.setStatus(resolved);
        order.setFulfillmentPlanJson(result.toJsonMap());

        Order saved = orderRepository.save(order);
        return toResponse(saved);
    }

    /**
     * 把 Python 履约结论收敛为 orders.fulfillment_suggestion_status 允许的取值：
     * READY_TO_SHIP / NEEDS_REVIEW / INSUFFICIENT_STOCK（与 V1 的 CHECK 约束一致）。
     */
    private String toSuggestionStatus(PythonFulfillmentResult result, Order order) {
        if (Boolean.TRUE.equals(result.canShip())) {
            return "READY_TO_SHIP";
        }
        // 仍缺库存时保留库存不足态，其余统一转人工审核。
        if ("INSUFFICIENT_STOCK".equals(order.getStatus())) {
            return "INSUFFICIENT_STOCK";
        }
        return "NEEDS_REVIEW";
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
                o.getCreatedAt(),
                o.getUpdatedAt());
    }
}
