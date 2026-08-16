package com.lth.ecommerceagent.product;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
    java.util.List<Product> findAllByStoreId(Long storeId);
    java.util.List<Product> findAllByCompanyId(Long companyId);
    java.util.Optional<Product> findByIdAndCompanyId(Long id,Long companyId);
    java.util.Optional<Product> findByIdAndStoreId(Long id,Long storeId);
    @Override default java.util.List<Product> findAll(){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()):findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    @Override default java.util.Optional<Product> findById(Long id){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByIdAndStoreId(id,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByIdAndCompanyId(id,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
}
