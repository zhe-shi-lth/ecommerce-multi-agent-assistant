package com.lth.ecommerceagent.inventory;

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
@RequestMapping("/api/inventories")
public class InventoryController {

    private final InventoryRepository inventoryRepository;
    private final ProductRepository productRepository;

    public InventoryController(InventoryRepository inventoryRepository, ProductRepository productRepository) {
        this.inventoryRepository = inventoryRepository;
        this.productRepository = productRepository;
    }

    @PostMapping
    public ResponseEntity<InventoryResponse> create(@RequestBody InventoryCreateRequest request) {
        Product product = findProduct(request.productId());
        Inventory inventory = new Inventory();
        apply(request, product, inventory);
        Inventory saved = inventoryRepository.save(inventory);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public List<InventoryResponse> list() {
        return inventoryRepository.findAll().stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public InventoryResponse get(@PathVariable Long id) {
        return toResponse(findInventory(id));
    }

    @GetMapping("/by-product/{productId}")
    public InventoryResponse getByProduct(@PathVariable Long productId) {
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Inventory not found for product: " + productId));
        return toResponse(inventory);
    }

    @PutMapping("/{id}")
    public InventoryResponse update(@PathVariable Long id, @RequestBody InventoryCreateRequest request) {
        Inventory inventory = findInventory(id);
        Product product = findProduct(request.productId());
        apply(request, product, inventory);
        return toResponse(inventoryRepository.save(inventory));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Inventory inventory = findInventory(id);
        inventoryRepository.delete(inventory);
        return ResponseEntity.noContent().build();
    }

    private void apply(InventoryCreateRequest request, Product product, Inventory inventory) {
        inventory.setProduct(product);
        inventory.setCurrentStock(request.currentStock());
        inventory.setReservedStock(request.reservedStock());
        inventory.setSafeStockThreshold(request.safeStockThreshold());
        inventory.setPurchaseCycleDays(request.purchaseCycleDays());
        inventory.setSalesLast7Days(request.salesLast7Days());
        inventory.setInventoryStatus(request.inventoryStatus());
    }

    private Product findProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product not found: " + id));
    }

    private Inventory findInventory(Long id) {
        return inventoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory not found: " + id));
    }

    private InventoryResponse toResponse(Inventory i) {
        return new InventoryResponse(
                i.getId(),
                i.getProduct().getId(),
                i.getCurrentStock(),
                i.getReservedStock(),
                i.getSafeStockThreshold(),
                i.getPurchaseCycleDays(),
                i.getSalesLast7Days(),
                i.getInventoryStatus(),
                i.getCreatedAt(),
                i.getUpdatedAt());
    }
}
