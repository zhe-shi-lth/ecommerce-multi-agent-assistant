package com.lth.ecommerceagent.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessAuditLogRepository extends JpaRepository<BusinessAuditLog, Long> {
    List<BusinessAuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId);
}
