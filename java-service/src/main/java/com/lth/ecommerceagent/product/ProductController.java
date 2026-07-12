package com.lth.ecommerceagent.product;

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

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@RequestBody ProductCreateRequest request) {
        Product product = new Product();
        apply(request, product);
        Product saved = productRepository.save(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public List<ProductResponse> list() {
        return productRepository.findAll().stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable Long id) {
        return toResponse(findProduct(id));
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable Long id, @RequestBody ProductCreateRequest request) {
        Product product = findProduct(id);
        apply(request, product);
        return toResponse(productRepository.save(product));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Product product = findProduct(id);
        productRepository.delete(product);
        return ResponseEntity.noContent().build();
    }

    private void apply(ProductCreateRequest request, Product product) {
        product.setName(request.name());
        product.setCategory(request.category());
        product.setDescription(request.description());
        product.setCostPrice(request.costPrice());
        product.setSalePrice(request.salePrice());
        // 前端建商品无需关心状态/人群/场景，缺省兜底，避免 NOT NULL 约束 500
        product.setTargetAudience(request.targetAudience() != null ? request.targetAudience() : "");
        product.setUsageScenario(request.usageScenario() != null ? request.usageScenario() : "");
        product.setStatus(request.status() != null ? request.status() : "DRAFT");
    }

    private Product findProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + id));
    }

    private ProductResponse toResponse(Product p) {
        return new ProductResponse(
                p.getId(),
                p.getName(),
                p.getCategory(),
                p.getDescription(),
                p.getCostPrice(),
                p.getSalePrice(),
                p.getTargetAudience(),
                p.getUsageScenario(),
                p.getStatus(),
                p.getCreatedAt(),
                p.getUpdatedAt());
    }
}
