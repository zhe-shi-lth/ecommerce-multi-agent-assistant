package com.lth.ecommerceagent.agent;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AgentRunRepository extends JpaRepository<AgentRun, Long> {

    @EntityGraph(attributePaths = "operationPlan")
    List<AgentRun> findAllByStoreId(Long storeId);

    @EntityGraph(attributePaths = "operationPlan")
    Optional<AgentRun> findByIdAndStoreId(Long id,Long storeId);

    @EntityGraph(attributePaths = "operationPlan")
    @Query("select r from AgentRun r where r.companyId=:companyId") List<AgentRun> findAllByCompanyId(@Param("companyId") Long companyId);
    @EntityGraph(attributePaths = "operationPlan")
    @Query("select r from AgentRun r where r.id=:id and r.companyId=:companyId") Optional<AgentRun> findByIdAndCompanyId(@Param("id") Long id,@Param("companyId") Long companyId);

    @Override default List<AgentRun> findAll(){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()):findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    @Override default Optional<AgentRun> findById(Long id){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByIdAndStoreId(id,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByIdAndCompanyId(id,com.lth.ecommerceagent.tenant.TenantContext.companyId());}

    @EntityGraph(attributePaths = "operationPlan")
    List<AgentRun> findByOperationPlanIdAndStoreId(Long operationPlanId,Long storeId);
    default List<AgentRun> findByOperationPlanId(Long id){return findByOperationPlanIdAndStoreId(id,com.lth.ecommerceagent.tenant.TenantContext.storeId());}
}
