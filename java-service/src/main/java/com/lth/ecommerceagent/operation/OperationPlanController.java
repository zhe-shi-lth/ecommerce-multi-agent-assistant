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

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonAgentException;
import com.lth.ecommerceagent.python.PythonPublishListingRequest;
import com.lth.ecommerceagent.python.PythonPublishListingResult;

@RestController
@RequestMapping("/api/operation-plans")
public class OperationPlanController {

    private final OperationPlanRepository operationPlanRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final InventoryRepository inventoryRepository;
    private final PythonAgentClient pythonAgentClient;

    public OperationPlanController(
            OperationPlanRepository operationPlanRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            InventoryRepository inventoryRepository,
            PythonAgentClient pythonAgentClient) {
        this.operationPlanRepository = operationPlanRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.inventoryRepository = inventoryRepository;
        this.pythonAgentClient = pythonAgentClient;
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

    private Map<String, Object> withPublishResult(
            Map<String, Object> productPlanJson,
            PythonPublishListingResult publishResult) {
        Map<String, Object> next = new HashMap<>(productPlanJson != null ? productPlanJson : Map.of());
        Map<String, Object> publish = new HashMap<>();
        publish.put("success", publishResult.success());
        publish.put("platform", publishResult.platform());
        publish.put("message", publishResult.message());
        publish.put("external_item_id", publishResult.externalItemId());
        publish.put("external_url", publishResult.externalUrl());
        publish.put("raw", publishResult.raw());
        next.put("publish_result", publish);
        return next;
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
    public ResponseEntity<OperationPlanResponse> confirm(@PathVariable Long id) {
        OperationPlan plan = findPlan(id);
        Product product = plan.getProduct();

        // 线2 确定性发布前审核（纯 DB 校验，不依赖外部模型）：
        // 商品存在 + 已建库存 + 当前库存 > 安全阈值，才允许发布。
        String auditMessage;
        boolean auditPassed;
        if (product == null) {
            auditPassed = false;
            auditMessage = "商品不存在，无法发布";
        } else {
            java.util.Optional<Inventory> invOpt = inventoryRepository.findByProductId(product.getId());
            if (invOpt.isEmpty()) {
                auditPassed = false;
                auditMessage = "该商品尚未创建库存，请先到「库存」页建立库存后再发布";
            } else {
                Inventory inv = invOpt.get();
                int current = inv.getCurrentStock() != null ? inv.getCurrentStock() : 0;
                int threshold = inv.getSafeStockThreshold() != null ? inv.getSafeStockThreshold() : 0;
                if (current <= threshold) {
                    auditPassed = false;
                    auditMessage = String.format(
                            "库存不足：当前 %d ≤ 安全阈值 %d，请先补足库存", current, threshold);
                } else {
                    auditPassed = true;
                    auditMessage = "线2 审核通过，商品已发布";
                }
            }
        }

        if (!auditPassed) {
            // 审核不通过：保持 PENDING，不发布，返回 409 + 原因。
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(toResponse(plan, false, auditMessage));
        }

        PythonPublishListingResult publishResult;
        try {
            publishResult = pythonAgentClient.publishListing(PythonPublishListingRequest.from(plan));
        } catch (PythonAgentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(toResponse(plan, false, "平台发布失败：" + e.getMessage()));
        }
        if (!Boolean.TRUE.equals(publishResult.success())) {
            String message = publishResult.message() == null || publishResult.message().isBlank()
                    ? "平台发布失败：未返回成功状态"
                    : "平台发布失败：" + publishResult.message();
            return ResponseEntity.status(HttpStatus.CONFLICT).body(toResponse(plan, false, message));
        }

        plan.setProductPlanJson(withPublishResult(plan.getProductPlanJson(), publishResult));
        plan.setConfirmationStatus("CONFIRMED");
        plan.setConfirmedAt(Instant.now());
        product.setStatus("PUBLISHED");
        productRepository.save(product);
        OperationPlan saved = operationPlanRepository.save(plan);
        return ResponseEntity.ok(toResponse(saved, true, "平台发布成功：" + publishResult.message()));
    }

    @PostMapping("/{id}/reject")
    public OperationPlanResponse reject(@PathVariable Long id) {
        OperationPlan plan = findPlan(id);
        plan.setConfirmationStatus("REJECTED");
        plan.setConfirmedAt(Instant.now());
        return toResponse(operationPlanRepository.save(plan));
    }

    // 下架：仅已发布（CONFIRMED）的计划可下架。撤回商品发布状态 + 计划回到待审核，记录保留、可逆。
    @PostMapping("/{id}/unpublish")
    public ResponseEntity<OperationPlanResponse> unpublish(@PathVariable Long id) {
        OperationPlan plan = findPlan(id);
        if (!"CONFIRMED".equals(plan.getConfirmationStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(toResponse(plan, false, "该计划未发布，无法下架"));
        }
        plan.setConfirmationStatus("PENDING");
        plan.setConfirmedAt(null);
        Product product = plan.getProduct();
        if (product != null) {
            product.setStatus("DRAFT");
            productRepository.save(product);
        }
        OperationPlan saved = operationPlanRepository.save(plan);
        return ResponseEntity.ok(toResponse(saved, true, "已下架"));
    }

    private void apply(OperationPlanCreateRequest request, Product product, Order order, OperationPlan plan) {
        plan.setTraceId(request.traceId());
        plan.setProduct(product);
        if (order != null) {
            plan.setOrder(order);
        }
        // 平台取值优先级：请求显式指定 > 关联订单的平台 > 默认 taobao
        String platform = request.platform();
        if (platform == null || platform.isBlank()) {
            if (order != null && order.getPlatform() != null) {
                platform = order.getPlatform();
            } else {
                platform = "unspecified";
            }
        }
        plan.setPlatform(platform);
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
        return toResponse(p, null, null);
    }

    private OperationPlanResponse toResponse(OperationPlan p, Boolean auditPassed, String auditMessage) {
        Long orderId = p.getOrder() != null ? p.getOrder().getId() : null;
        return new OperationPlanResponse(
                p.getId(),
                p.getTraceId(),
                p.getProduct().getId(),
                orderId,
                p.getPlatform(),
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
                p.getLine(),
                auditPassed,
                auditMessage);
    }
}
