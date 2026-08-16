package com.lth.ecommerceagent.platformtask;
import java.time.Instant; import java.util.List; import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface PlatformTaskRepository extends JpaRepository<PlatformTask,Long>{
 Optional<PlatformTask> findByIdempotencyKeyAndStoreId(String key,Long storeId);
 default Optional<PlatformTask> findByIdempotencyKey(String key){return findByIdempotencyKeyAndStoreId(key,com.lth.ecommerceagent.tenant.TenantContext.storeId());}
 List<PlatformTask> findByEntityTypeAndEntityIdAndStoreIdOrderByCreatedAtDesc(String entityType,Long entityId,Long storeId);
 default List<PlatformTask> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String t,Long id){return findByEntityTypeAndEntityIdAndStoreIdOrderByCreatedAtDesc(t,id,com.lth.ecommerceagent.tenant.TenantContext.storeId());}
 List<PlatformTask> findByStatusOrderByCreatedAtAsc(String status);
 List<PlatformTask> findByStatusAndStoreIdOrderByCreatedAtAsc(String status,Long storeId);
 List<PlatformTask> findByStatusAndCompanyIdOrderByCreatedAtAsc(String status,Long companyId);
 List<PlatformTask> findAllByStoreId(Long storeId); List<PlatformTask> findAllByCompanyId(Long companyId);
 default List<PlatformTask> findVisibleByStatus(String status){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByStatusAndStoreIdOrderByCreatedAtAsc(status,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByStatusAndCompanyIdOrderByCreatedAtAsc(status,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
 default List<PlatformTask> findVisibleAll(){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()):findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select t from PlatformTask t where t.id=:id and t.storeId=:#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}") Optional<PlatformTask> findByIdForUpdate(@Param("id")Long id);
 @Query("select t from PlatformTask t where "
   + "(t.status='FAILED' and t.attemptCount<t.maxAttempts and (t.nextRetryAt is null or t.nextRetryAt<=:now)) "
   + "or (t.status='EXTERNAL_SUCCEEDED' and t.nextRetryAt is not null and t.nextRetryAt<=:now) "
   + "order by t.createdAt") List<PlatformTask> findRetryable(@Param("now")Instant now);
 @Query("select t from PlatformTask t where t.status='RUNNING' and t.updatedAt<:before order by t.updatedAt") List<PlatformTask> findStaleRunning(@Param("before")Instant before);
}
