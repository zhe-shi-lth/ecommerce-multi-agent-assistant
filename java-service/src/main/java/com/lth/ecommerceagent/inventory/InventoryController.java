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
import org.springframework.security.access.prepost.PreAuthorize;

import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;

@RestController
@RequestMapping("/api/inventories")
@PreAuthorize("hasAuthority('PERM_INVENTORY_VIEW') or hasAuthority('PERM_INVENTORY_ADJUST')")
public class InventoryController {

    private final InventoryRepository inventoryRepository;
    private final ProductRepository productRepository;
    private final InventoryMovementRepository movementRepository;
    private final InventoryMovementService movementService;

    public InventoryController(InventoryRepository inventoryRepository, ProductRepository productRepository,
            InventoryMovementRepository movementRepository, InventoryMovementService movementService) {
        this.inventoryRepository = inventoryRepository;
        this.productRepository = productRepository;
        this.movementRepository = movementRepository;
        this.movementService = movementService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_INVENTORY_VIEW') or hasAuthority('PERM_INVENTORY_CREATE') or hasAuthority('PERM_INVENTORY_ADJUST')")
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
        throw new ResponseStatusException(HttpStatus.METHOD_NOT_ALLOWED,
                "库存不允许通用覆盖，请使用盘点调整或采购入库动作");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        throw new ResponseStatusException(HttpStatus.METHOD_NOT_ALLOWED,
                "库存是业务账目，不允许删除");
    }

    @PostMapping("/{id}/adjust")
    @PreAuthorize("hasAuthority('PERM_INVENTORY_ADJUST')")
    public InventoryResponse adjust(@PathVariable Long id, @RequestBody InventoryAdjustmentRequest request) {
        Inventory inventory = findInventory(id);
        if (request.newCurrentStock() == null || request.newCurrentStock() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "盘点后的实物库存必须大于等于 0");
        }
        if (request.reason() == null || request.reason().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "盘点调整必须填写原因");
        }
        int before = inventory.getCurrentStock();
        if (inventoryRepository.adjustCurrentStock(inventory.getProduct().getId(), request.newCurrentStock()) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "调整后实物库存不能低于已预留库存");
        }
        movementService.record(inventory.getProduct().getId(), "MANUAL_ADJUST",
                request.newCurrentStock() - before, 0, "INVENTORY", inventory.getId(), request.reason().trim());
        return toResponse(findInventory(id));
    }

    @GetMapping("/{id}/movements")
    public List<InventoryMovementResponse> movements(@PathVariable Long id) {
        Inventory inventory = findInventory(id);
        return movementRepository.findByProductIdOrderByCreatedAtDesc(inventory.getProduct().getId())
                .stream().map(InventoryMovementResponse::from).toList();
    }

    private void apply(InventoryCreateRequest request, Product product, Inventory inventory) {
        inventory.setProduct(product);
        // 前端建库存只需商品/当前库存/安全阈值，其余字段缺省兜底，避免 NOT NULL 约束 500
        int currentStock = request.currentStock() != null ? request.currentStock() : 0;
        int safeThreshold = request.safeStockThreshold() != null ? request.safeStockThreshold() : 0;
        inventory.setCurrentStock(currentStock);
        // 新建库存不能伪造已预留量；预留只能由订单状态机产生。
        inventory.setReservedStock(0);
        inventory.setSafeStockThreshold(safeThreshold);
        inventory.setPurchaseCycleDays(request.purchaseCycleDays() != null ? request.purchaseCycleDays() : 0);
        inventory.setSalesLast7Days(request.salesLast7Days() != null ? request.salesLast7Days() : 0);
        // 状态未传则按 当前库存 < 安全阈值 推导 RISK / ENOUGH（须符合 ck_inventories_status 约束）
        String status = currentStock < safeThreshold
                ? "RISK"
                : currentStock < safeThreshold * 2 ? "LOW" : "ENOUGH";
        inventory.setInventoryStatus(status);
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
