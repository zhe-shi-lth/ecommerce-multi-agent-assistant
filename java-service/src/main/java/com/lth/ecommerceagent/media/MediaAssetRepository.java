package com.lth.ecommerceagent.media;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface MediaAssetRepository extends JpaRepository<MediaAsset,Long>{
 boolean existsByOperationPlanIdAndStorageUrlAndStoreId(Long planId,String url,Long storeId);
 boolean existsByOperationPlanIdAndStorageUrlAndCompanyId(Long planId,String url,Long companyId);
 List<MediaAsset> findByOperationPlanIdAndStoreIdOrderByCreatedAt(Long planId,Long storeId);
 List<MediaAsset> findByOperationPlanIdAndCompanyIdOrderByCreatedAt(Long planId,Long companyId);
 default boolean existsByOperationPlanIdAndStorageUrl(Long p,String u){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?existsByOperationPlanIdAndStorageUrlAndStoreId(p,u,com.lth.ecommerceagent.tenant.TenantContext.storeId()):existsByOperationPlanIdAndStorageUrlAndCompanyId(p,u,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
 default List<MediaAsset> findByOperationPlanIdOrderByCreatedAt(Long p){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByOperationPlanIdAndStoreIdOrderByCreatedAt(p,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByOperationPlanIdAndCompanyIdOrderByCreatedAt(p,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
}
