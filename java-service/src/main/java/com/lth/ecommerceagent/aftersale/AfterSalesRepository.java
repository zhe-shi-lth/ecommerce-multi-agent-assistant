package com.lth.ecommerceagent.aftersale;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface AfterSalesRepository extends JpaRepository<AfterSalesOrder, Long> {
    @Query("select a from AfterSalesOrder a where a.order.id=:orderId and " +
      "((:#{T(com.lth.ecommerceagent.tenant.TenantContext).hasStoreContext()}=true and a.storeId=:#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}) or " +
      "(:#{T(com.lth.ecommerceagent.tenant.TenantContext).hasStoreContext()}=false and a.companyId=:#{T(com.lth.ecommerceagent.tenant.TenantContext).companyId()})) order by a.createdAt desc")
    List<AfterSalesOrder> findByOrderIdOrderByCreatedAtDesc(Long orderId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from AfterSalesOrder a join fetch a.order o join fetch o.product where a.id=:id and ((:#{T(com.lth.ecommerceagent.tenant.TenantContext).hasStoreContext()}=true and a.storeId=:#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}) or (:#{T(com.lth.ecommerceagent.tenant.TenantContext).hasStoreContext()}=false and a.companyId=:#{T(com.lth.ecommerceagent.tenant.TenantContext).companyId()}))")
    Optional<AfterSalesOrder> findByIdForUpdate(@Param("id") Long id);
    @Query("select coalesce(sum(a.quantity),0) from AfterSalesOrder a where a.order.id=:orderId and a.status <> 'REJECTED'")
    Integer allocatedQuantity(@Param("orderId") Long orderId);
    @Query("select coalesce(sum(a.refundAmount),0) from AfterSalesOrder a where a.order.id=:orderId and a.status <> 'REJECTED'")
    BigDecimal allocatedAmount(@Param("orderId") Long orderId);
    @Query("select coalesce(sum(a.quantity),0) from AfterSalesOrder a where a.order.id=:orderId and a.status in ('WAITING_RETURN','COMPLETED')")
    Integer approvedRefundQuantity(@Param("orderId") Long orderId);
    @Query("select coalesce(sum(a.refundAmount),0) from AfterSalesOrder a where a.order.id=:orderId and a.status in ('WAITING_RETURN','COMPLETED')")
    BigDecimal approvedRefundAmount(@Param("orderId") Long orderId);
    @Query("select coalesce(sum(a.quantity),0) from AfterSalesOrder a where a.order.id=:orderId and a.status='COMPLETED' and a.type='RETURN_REFUND'")
    Integer completedReturnQuantity(@Param("orderId") Long orderId);
}
