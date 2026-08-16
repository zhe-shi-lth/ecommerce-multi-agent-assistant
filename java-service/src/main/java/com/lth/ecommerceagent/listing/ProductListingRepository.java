package com.lth.ecommerceagent.listing;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductListingRepository extends JpaRepository<ProductListing, Long> {
    Optional<ProductListing> findByProductIdAndPlatformAndStoreId(Long productId, String platform, Long storeId);
    List<ProductListing> findByProductIdAndStoreIdOrderByPlatform(Long productId, Long storeId);
    boolean existsByProductIdAndStatusAndStoreId(Long productId, String status, Long storeId);
    List<ProductListing> findAllByStoreId(Long storeId);
    List<ProductListing> findAllByCompanyId(Long companyId);
    Optional<ProductListing> findByProductIdAndPlatformAndCompanyId(Long productId,String platform,Long companyId);
    List<ProductListing> findByProductIdAndCompanyIdOrderByPlatform(Long productId,Long companyId);
    boolean existsByProductIdAndStatusAndCompanyId(Long productId,String status,Long companyId);
    default Optional<ProductListing> findByProductIdAndPlatform(Long p,String platform){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByProductIdAndPlatformAndStoreId(p,platform,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByProductIdAndPlatformAndCompanyId(p,platform,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    default List<ProductListing> findByProductIdOrderByPlatform(Long p){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByProductIdAndStoreIdOrderByPlatform(p,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByProductIdAndCompanyIdOrderByPlatform(p,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    default boolean existsByProductIdAndStatus(Long p,String status){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?existsByProductIdAndStatusAndStoreId(p,status,com.lth.ecommerceagent.tenant.TenantContext.storeId()):existsByProductIdAndStatusAndCompanyId(p,status,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    @Override default List<ProductListing> findAll(){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()):findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}
}
