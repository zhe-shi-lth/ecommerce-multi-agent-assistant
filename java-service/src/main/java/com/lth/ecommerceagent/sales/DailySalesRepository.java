package com.lth.ecommerceagent.sales;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DailySalesRepository extends JpaRepository<DailySales, Long> {
    List<DailySales> findByProductIdAndStoreIdOrderBySaleDateAsc(Long productId, Long storeId);
    List<DailySales> findByProductIdAndCompanyIdOrderBySaleDateAsc(Long productId, Long companyId);

    List<DailySales> findByPlatformAndStoreIdOrderBySaleDateAsc(String platform, Long storeId);
    List<DailySales> findByPlatformAndCompanyIdOrderBySaleDateAsc(String platform, Long companyId);

    Optional<DailySales> findByProductIdAndPlatformAndSaleDateAndStoreId(Long productId, String platform, LocalDate saleDate, Long storeId);
    Optional<DailySales> findByProductIdAndPlatformAndSaleDateAndCompanyId(Long productId, String platform, LocalDate saleDate, Long companyId);
    List<DailySales> findAllByStoreId(Long storeId);
    List<DailySales> findAllByCompanyId(Long companyId);
    default boolean storeScoped() { return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext(); }
    default List<DailySales> byProduct(Long productId) { return storeScoped() ? findByProductIdAndStoreIdOrderBySaleDateAsc(productId, com.lth.ecommerceagent.tenant.TenantContext.storeId()) : findByProductIdAndCompanyIdOrderBySaleDateAsc(productId, com.lth.ecommerceagent.tenant.TenantContext.companyId()); }
    default List<DailySales> byPlatform(String platform) { return storeScoped() ? findByPlatformAndStoreIdOrderBySaleDateAsc(platform, com.lth.ecommerceagent.tenant.TenantContext.storeId()) : findByPlatformAndCompanyIdOrderBySaleDateAsc(platform, com.lth.ecommerceagent.tenant.TenantContext.companyId()); }
    default List<DailySales> scopedAll() { return storeScoped() ? findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()) : findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId()); }
}
