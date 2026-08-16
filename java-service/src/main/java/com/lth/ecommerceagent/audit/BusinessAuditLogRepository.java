package com.lth.ecommerceagent.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessAuditLogRepository extends JpaRepository<BusinessAuditLog, Long> {
    List<BusinessAuditLog> findByCompanyIdOrderByCreatedAtDesc(Long companyId);
    List<BusinessAuditLog> findByEntityTypeAndEntityIdAndStoreIdOrderByCreatedAtDesc(String entityType,Long entityId,Long storeId);
    default List<BusinessAuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String type,Long id){return findByEntityTypeAndEntityIdAndStoreIdOrderByCreatedAtDesc(type,id,com.lth.ecommerceagent.tenant.TenantContext.storeId());}
}
