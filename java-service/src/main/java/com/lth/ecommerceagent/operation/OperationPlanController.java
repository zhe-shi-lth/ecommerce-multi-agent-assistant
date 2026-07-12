package com.lth.ecommerceagent.operation;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;

@RestController
@RequestMapping("/api/operation-plans")
public class OperationPlanController {

    private final OperationPlanRepository operationPlanRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    public OperationPlanController(
            OperationPlanRepository operationPlanRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository) {
        this.operationPlanRepository = operationPlanRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
    }

    @PostMapping
    public ResponseEntity<OperationPlanResponse> create(@RequestBody OperationPlanCreateRequest request) {
        Product product = findProduct(request.productId());
        Order order = request.orderId() != null ? findOrder(request.orderId()) : null;
        OperationPlan plan = new OperationPlan();
        apply(request, product, order, plan);
        OperationPlan saved = operationPlanRepository.save(plan);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public List<OperationPlanResponse> list() {
        return operationPlanRepository.findAll().stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public OperationPlanResponse get(@PathVariable Long id) {
        return toResponse(findPlan(id));
    }

    @GetMapping("/{id}/export")
    public Map<String, String> export(@PathVariable Long id, @RequestParam String platform) {
        OperationPlan plan = findPlan(id);
        String content = formatForPlatform(plan, platform);
        Map<String, String> result = new HashMap<>();
        result.put("platform", platform);
        result.put("content", content);
        return result;
    }

    // 按平台把运营计划格式化为可直接使用/粘贴的文案
    private String formatForPlatform(OperationPlan plan, String platform) {
        Map<String, Object> p = plan.getProductPlanJson();
        String title = asString(p.get("recommended_title"));
        List<Object> points = asList(p.get("selling_points"));
        String detail = asString(p.get("detail_description"));
        String listing = asString(p.get("listing_suggestion"));
        Map<String, Object> copies = asMap(p.get("platform_copies"));
        List<Object> keywords = asList(p.get("seo_keywords"));
        String line = System.lineSeparator();
        switch (platform.toLowerCase()) {
            case "taobao":
                StringBuilder tb = new StringBuilder();
                tb.append("<h1>").append(title).append("</h1>").append(line);
                tb.append("<p>").append(detail).append("</p>").append(line).append("<ul>");
                for (Object pt : points) {
                    tb.append("<li>").append(asString(pt)).append("</li>");
                }
                return tb.append("</ul>").append(line).append("<p>").append(listing).append("</p>")
                        .toString();
            case "douyin":
                String douyin = asString(copies.get("douyin"));
                return "【标题】" + title + line + "【文案】" + (douyin.isEmpty() ? detail : douyin)
                        + line + "【话题】" + keywords.stream().map(k -> "#" + asString(k))
                        .collect(Collectors.joining(" "));
            case "xiaohongshu":
                String xhs = asString(copies.get("xiaohongshu"));
                return "【正文】" + (xhs.isEmpty() ? detail : xhs) + line + "【标签】"
                        + keywords.stream().map(k -> "#" + asString(k)).collect(Collectors.joining(" "));
            default:
                return "【标题】" + title + line + "【卖点】"
                        + points.stream().map(this::asString).collect(Collectors.joining("、")) + line
                        + "【详情】" + detail;
        }
    }

    private String asString(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    @SuppressWarnings("unchecked")
    private List<Object> asList(Object o) {
        return o instanceof List ? (List<Object>) o : List.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : Map.of();
    }

    @GetMapping("/by-trace/{traceId}")
    public OperationPlanResponse getByTrace(@PathVariable String traceId) {
        OperationPlan plan = operationPlanRepository.findByTraceId(traceId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Operation plan not found for trace: " + traceId));
        return toResponse(plan);
    }

    @PutMapping("/{id}")
    public OperationPlanResponse update(@PathVariable Long id, @RequestBody OperationPlanCreateRequest request) {
        OperationPlan plan = findPlan(id);
        Product product = findProduct(request.productId());
        Order order = request.orderId() != null ? findOrder(request.orderId()) : null;
        apply(request, product, order, plan);
        return toResponse(operationPlanRepository.save(plan));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        OperationPlan plan = findPlan(id);
        operationPlanRepository.delete(plan);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/confirm")
    public OperationPlanResponse confirm(@PathVariable Long id) {
        OperationPlan plan = findPlan(id);
        plan.setConfirmationStatus("CONFIRMED");
        plan.setConfirmedAt(Instant.now());
        return toResponse(operationPlanRepository.save(plan));
    }

    @PostMapping("/{id}/reject")
    public OperationPlanResponse reject(@PathVariable Long id) {
        OperationPlan plan = findPlan(id);
        plan.setConfirmationStatus("REJECTED");
        plan.setConfirmedAt(Instant.now());
        return toResponse(operationPlanRepository.save(plan));
    }

    private void apply(OperationPlanCreateRequest request, Product product, Order order, OperationPlan plan) {
        plan.setTraceId(request.traceId());
        plan.setProduct(product);
        if (order != null) {
            plan.setOrder(order);
        }
        plan.setProductPlanJson(request.productPlanJson());
        plan.setImagePlanJson(request.imagePlanJson());
        plan.setInventoryPlanJson(request.inventoryPlanJson());
        plan.setFulfillmentPlanJson(request.fulfillmentPlanJson());
        plan.setFinalSummary(request.finalSummary());
        plan.setManualReviewRequired(request.manualReviewRequired());
        plan.setStatus(request.status());
        plan.setLine(request.line() != null ? request.line() : "LINE2_MONITOR");
    }

    private Product findProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product not found: " + id));
    }

    private Order findOrder(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order not found: " + id));
    }

    private OperationPlan findPlan(Long id) {
        return operationPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Operation plan not found: " + id));
    }

    private OperationPlanResponse toResponse(OperationPlan p) {
        Long orderId = p.getOrder() != null ? p.getOrder().getId() : null;
        return new OperationPlanResponse(
                p.getId(),
                p.getTraceId(),
                p.getProduct().getId(),
                orderId,
                p.getProductPlanJson(),
                p.getImagePlanJson(),
                p.getInventoryPlanJson(),
                p.getFulfillmentPlanJson(),
                p.getFinalSummary(),
                p.getManualReviewRequired(),
                p.getStatus(),
                p.getConfirmationStatus(),
                p.getConfirmedAt(),
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getLine());
    }
}
