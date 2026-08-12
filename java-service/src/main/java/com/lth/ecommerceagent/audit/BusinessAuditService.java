package com.lth.ecommerceagent.audit;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class BusinessAuditService {
    private final BusinessAuditLogRepository repository;

    public BusinessAuditService(BusinessAuditLogRepository repository) {
        this.repository = repository;
    }

    public void record(String domain, String entityType, Long entityId, String action,
            String beforeStatus, String afterStatus, String detail) {
        BusinessAuditLog log = new BusinessAuditLog();
        log.setDomain(domain);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setAction(action);
        log.setBeforeStatus(beforeStatus);
        log.setAfterStatus(afterStatus);
        log.setOperator(currentOperator());
        log.setDetail(detail);
        repository.save(log);
    }

    private String currentOperator() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || !auth.isAuthenticated() ? "SYSTEM" : auth.getName();
    }
}
