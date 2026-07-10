package com.lth.ecommerceagent.operation;

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
        Order order = findOrder(request.orderId());
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
        Order order = findOrder(request.orderId());
        apply(request, product, order, plan);
        return toResponse(operationPlanRepository.save(plan));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        OperationPlan plan = findPlan(id);
        operationPlanRepository.delete(plan);
        return ResponseEntity.noContent().build();
    }

    private void apply(OperationPlanCreateRequest request, Product product, Order order, OperationPlan plan) {
        plan.setTraceId(request.traceId());
        plan.setProduct(product);
        plan.setOrder(order);
        plan.setProductPlanJson(request.productPlanJson());
        plan.setImagePlanJson(request.imagePlanJson());
        plan.setInventoryPlanJson(request.inventoryPlanJson());
        plan.setFulfillmentPlanJson(request.fulfillmentPlanJson());
        plan.setFinalSummary(request.finalSummary());
        plan.setManualReviewRequired(request.manualReviewRequired());
        plan.setStatus(request.status());
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
        return new OperationPlanResponse(
                p.getId(),
                p.getTraceId(),
                p.getProduct().getId(),
                p.getOrder().getId(),
                p.getProductPlanJson(),
                p.getImagePlanJson(),
                p.getInventoryPlanJson(),
                p.getFulfillmentPlanJson(),
                p.getFinalSummary(),
                p.getManualReviewRequired(),
                p.getStatus(),
                p.getCreatedAt(),
                p.getUpdatedAt());
    }
}
