package com.lth.ecommerceagent.purchase;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PurchaseReceiptRepository extends JpaRepository<PurchaseReceipt, Long> {
    boolean existsByReceiptNoAndStoreId(String receiptNo,Long storeId); boolean existsByReceiptNoAndCompanyId(String receiptNo,Long companyId);
    Optional<PurchaseReceipt> findByReceiptNoAndStoreId(String receiptNo,Long storeId); Optional<PurchaseReceipt> findByReceiptNoAndCompanyId(String receiptNo,Long companyId);
    List<PurchaseReceipt> findByPurchaseOrderIdAndStoreIdOrderByReceivedAtAsc(Long id,Long storeId); List<PurchaseReceipt> findByPurchaseOrderIdAndCompanyIdOrderByReceivedAtAsc(Long id,Long companyId);
    default boolean existsByReceiptNo(String n){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?existsByReceiptNoAndStoreId(n,com.lth.ecommerceagent.tenant.TenantContext.storeId()):existsByReceiptNoAndCompanyId(n,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    default Optional<PurchaseReceipt> findByReceiptNo(String n){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByReceiptNoAndStoreId(n,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByReceiptNoAndCompanyId(n,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    default List<PurchaseReceipt> findByPurchaseOrderIdOrderByReceivedAtAsc(Long id){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByPurchaseOrderIdAndStoreIdOrderByReceivedAtAsc(id,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByPurchaseOrderIdAndCompanyIdOrderByReceivedAtAsc(id,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
}
