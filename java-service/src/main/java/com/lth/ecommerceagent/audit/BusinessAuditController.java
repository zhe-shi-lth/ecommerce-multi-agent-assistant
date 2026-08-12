package com.lth.ecommerceagent.audit;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
}
