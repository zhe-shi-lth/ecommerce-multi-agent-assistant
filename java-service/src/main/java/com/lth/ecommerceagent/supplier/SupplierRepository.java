package com.lth.ecommerceagent.supplier;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    java.util.List<Supplier> findAllByCompanyId(Long companyId);
    java.util.Optional<Supplier> findByIdAndCompanyId(Long id,Long companyId);
    boolean existsByCompanyIdAndName(Long companyId,String name);
    @Override default java.util.List<Supplier> findAll(){return findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    @Override default java.util.Optional<Supplier> findById(Long id){return findByIdAndCompanyId(id,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    default boolean existsByName(String name){return existsByCompanyIdAndName(com.lth.ecommerceagent.tenant.TenantContext.companyId(),name);}
}
