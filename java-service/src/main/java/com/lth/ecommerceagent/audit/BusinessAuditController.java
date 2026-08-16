package com.lth.ecommerceagent.audit;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import com.lth.ecommerceagent.tenant.TenantContext;

@RestController
@RequestMapping("/api/audit-logs")
public class BusinessAuditController {
    private final BusinessAuditLogRepository repository;

    public BusinessAuditController(BusinessAuditLogRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<BusinessAuditLog> list(@RequestParam String entityType, @RequestParam Long entityId) {
        return repository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
    }
    @GetMapping("/company/{companyId}") @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('OWNER')")
    public List<BusinessAuditLog> company(@org.springframework.web.bind.annotation.PathVariable Long companyId) {
        var p = TenantContext.principal(); if (p == null || (!p.isSuperAdmin() && !companyId.equals(p.companyId()))) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN);
        return repository.findByCompanyIdOrderByCreatedAtDesc(companyId);
    }
}
