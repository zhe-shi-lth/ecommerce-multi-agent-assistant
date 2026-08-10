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

import com.lth.ecommerceagent.supplier.Supplier;
import com.lth.ecommerceagent.supplier.SupplierRepository;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;
    private final SupplierRepository supplierRepository;

    public ProductController(ProductRepository productRepository, SupplierRepository supplierRepository) {
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
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

    @PostMapping("/{id}/publish")
    public ProductResponse publish(@PathVariable Long id) {
        Product product = findProduct(id);
        product.setStatus("PUBLISHED");
        return toResponse(productRepository.save(product));
    }

    private void apply(ProductCreateRequest request, Product product) {
        product.setName(request.getName());
        product.setCategory(request.getCategory());
        product.setDescription(request.getDescription());
        product.setCostPrice(request.getCostPrice());
        product.setSalePrice(request.getSalePrice());
        // 前端建商品无需关心状态/人群/场景，缺省兜底，避免 NOT NULL 约束 500
        product.setTargetAudience(request.getTargetAudience() != null ? request.getTargetAudience() : "");
        product.setUsageScenario(request.getUsageScenario() != null ? request.getUsageScenario() : "");
        product.setStatus(request.getStatus() != null ? request.getStatus() : "DRAFT");
        // supplierId：仅当 JSON 显式传入（含 null）才更新。null = 清空绑定商家；未传则保留原值，
        // 避免编辑其它字段时误清空已绑定商家。
        if (request.isSupplierIdSet()) {
            if (request.getSupplierId() != null) {
                Supplier supplier = supplierRepository.findById(request.getSupplierId())
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND, "进货商家不存在：" + request.getSupplierId()));
                product.setSupplier(supplier);
            } else {
                product.setSupplier(null);
            }
        }
    }

    private Product findProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + id));
    }

    private ProductResponse toResponse(Product p) {
        Supplier s = p.getSupplier();
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
                s != null ? s.getId() : null,
                s != null ? s.getName() : null,
                p.getCreatedAt(),
                p.getUpdatedAt());
    }
}
