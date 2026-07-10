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

import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;

    public OrderController(OrderRepository orderRepository, ProductRepository productRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> create(@RequestBody OrderCreateRequest request) {
        Product product = findProduct(request.productId());
        Order order = new Order();
        apply(request, product, order);
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

    private void apply(OrderCreateRequest request, Product product, Order order) {
        order.setProduct(product);
        order.setQuantity(request.quantity());
        order.setStatus(request.status());
        order.setAddressComplete(request.addressComplete());
        order.setPaid(request.paid());
        order.setManualReviewRequired(request.manualReviewRequired());
        order.setFulfillmentSuggestionStatus(request.fulfillmentSuggestionStatus());
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
                o.getQuantity(),
                o.getStatus(),
                o.getAddressComplete(),
                o.getPaid(),
                o.getManualReviewRequired(),
                o.getFulfillmentSuggestionStatus(),
                o.getCreatedAt(),
                o.getUpdatedAt());
    }
}
