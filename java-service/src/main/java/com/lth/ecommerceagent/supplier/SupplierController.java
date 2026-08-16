package com.lth.ecommerceagent.supplier;

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

import com.lth.ecommerceagent.purchase.PurchaseOrderRepository;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierRepository supplierRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public SupplierController(
            SupplierRepository supplierRepository,
            PurchaseOrderRepository purchaseOrderRepository) {
        this.supplierRepository = supplierRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    @GetMapping
    public List<SupplierResponse> list() {
        return supplierRepository.findAll().stream().map(SupplierResponse::from).toList();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_SUPPLIER_MANAGE')")
    public ResponseEntity<SupplierResponse> create(@RequestBody SupplierRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "商家名称不能为空");
        }
        if (supplierRepository.existsByName(request.name().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已存在同名商家：" + request.name().trim());
        }
        Supplier s = new Supplier();
        apply(request, s);
        Supplier saved = supplierRepository.save(s);
        return ResponseEntity.status(HttpStatus.CREATED).body(SupplierResponse.from(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_SUPPLIER_MANAGE')")
    public SupplierResponse update(@PathVariable Long id, @RequestBody SupplierRequest request) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商家不存在：" + id));
        if (request.name() != null && !request.name().isBlank()
                && !request.name().trim().equals(s.getName())
                && supplierRepository.existsByName(request.name().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已存在同名商家：" + request.name().trim());
        }
        apply(request, s);
        return SupplierResponse.from(supplierRepository.save(s));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_SUPPLIER_MANAGE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "商家不存在：" + id));
        if (purchaseOrderRepository.existsBySupplierRefId(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "该商家已有采购单引用，无法删除；如需停用请在编辑中设为「停用」");
        }
        supplierRepository.delete(s);
        return ResponseEntity.noContent().build();
    }

    private void apply(SupplierRequest r, Supplier s) {
        if (r.name() != null) s.setName(r.name().trim());
        if (r.contactName() != null) s.setContactName(r.contactName());
        if (r.contactPhone() != null) s.setContactPhone(r.contactPhone());
        if (r.address() != null) s.setAddress(r.address());
        if (r.settlementType() != null) s.setSettlementType(r.settlementType());
        if (r.leadTimeDays() != null) s.setLeadTimeDays(r.leadTimeDays());
        if (r.status() != null) s.setStatus(r.status());
        if (r.remark() != null) s.setRemark(r.remark());
    }
}
