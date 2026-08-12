package com.lth.ecommerceagent.purchase;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PurchaseReceiptRepository extends JpaRepository<PurchaseReceipt, Long> {
    boolean existsByReceiptNo(String receiptNo);
    Optional<PurchaseReceipt> findByReceiptNo(String receiptNo);
    List<PurchaseReceipt> findByPurchaseOrderIdOrderByReceivedAtAsc(Long purchaseOrderId);
}
