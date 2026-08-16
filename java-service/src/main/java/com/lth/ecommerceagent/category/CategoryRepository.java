package com.lth.ecommerceagent.category;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    java.util.List<Category> findAllByCompanyId(Long companyId);
    @Override default java.util.List<Category> findAll() { return findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId()); }
}
