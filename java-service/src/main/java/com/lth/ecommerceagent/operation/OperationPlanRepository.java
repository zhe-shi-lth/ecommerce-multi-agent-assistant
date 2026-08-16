package com.lth.ecommerceagent.operation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;

public interface OperationPlanRepository extends JpaRepository<OperationPlan, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from OperationPlan p join fetch p.product where p.id = :id and p.storeId=:#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}")
    Optional<OperationPlan> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"product", "order"})
    List<OperationPlan> findAllByStoreId(Long storeId);
    List<OperationPlan> findAllByCompanyId(Long companyId);
    Optional<OperationPlan> findByIdAndCompanyId(Long id,Long companyId);

    @EntityGraph(attributePaths = {"product", "order"})
    Optional<OperationPlan> findByIdAndStoreId(Long id,Long storeId);
    @Override default List<OperationPlan> findAll(){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()):findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    @Override default Optional<OperationPlan> findById(Long id){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByIdAndStoreId(id,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByIdAndCompanyId(id,com.lth.ecommerceagent.tenant.TenantContext.companyId());}

    @EntityGraph(attributePaths = {"product", "order"})
    Optional<OperationPlan> findByTraceIdAndStoreId(String traceId,Long storeId);
    default Optional<OperationPlan> findByTraceId(String trace){return findByTraceIdAndStoreId(trace,com.lth.ecommerceagent.tenant.TenantContext.storeId());}

    // 模拟拉单：只针对「已确认(CONFIRMED)」的运营计划——计划才代表商品已真正在某平台上架。
    @EntityGraph(attributePaths = {"product", "order"})
    List<OperationPlan> findByConfirmationStatus(String confirmationStatus);

    @EntityGraph(attributePaths = {"product", "order"})
    List<OperationPlan> findByConfirmationStatusAndPlatform(String confirmationStatus, String platform);
}
