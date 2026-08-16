package com.lth.ecommerceagent.inventory;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    @EntityGraph(attributePaths = "product")
    List<Inventory> findAllByStoreId(Long storeId);
    @EntityGraph(attributePaths = "product") List<Inventory> findAllByCompanyId(Long companyId);
    @EntityGraph(attributePaths = "product") Optional<Inventory> findByIdAndCompanyId(Long id,Long companyId);

    @EntityGraph(attributePaths = "product")
    Optional<Inventory> findByIdAndStoreId(Long id,Long storeId);

    @EntityGraph(attributePaths = "product")
    Optional<Inventory> findByProductIdAndStoreId(Long productId,Long storeId);
    @Override default List<Inventory> findAll(){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findAllByStoreId(com.lth.ecommerceagent.tenant.TenantContext.storeId()):findAllByCompanyId(com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    @Override default Optional<Inventory> findById(Long id){return com.lth.ecommerceagent.tenant.TenantContext.hasStoreContext()?findByIdAndStoreId(id,com.lth.ecommerceagent.tenant.TenantContext.storeId()):findByIdAndCompanyId(id,com.lth.ecommerceagent.tenant.TenantContext.companyId());}
    default Optional<Inventory> findByProductId(Long id){return findByProductIdAndStoreId(id,com.lth.ecommerceagent.tenant.TenantContext.storeId());}

    /** 原子预留库存：实物不变，只增加占用；可售库存必须足够。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE inventories
               SET reserved_stock = reserved_stock + :quantity,
                   inventory_status = CASE
                       WHEN current_stock - reserved_stock - :quantity < safe_stock_threshold THEN 'RISK'
                       WHEN current_stock - reserved_stock - :quantity < safe_stock_threshold * 2 THEN 'LOW'
                       ELSE 'ENOUGH'
                   END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE product_id = :productId
               AND store_id = :#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}
               AND current_stock - reserved_stock >= :quantity
            """, nativeQuery = true)
    int reserveStockIfAvailable(@Param("productId") Long productId, @Param("quantity") int quantity);

    /** 发货出库：同时减少实物库存与已预留库存。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE inventories
               SET current_stock = current_stock - :quantity,
                   reserved_stock = reserved_stock - :quantity,
                   inventory_status = CASE
                       WHEN current_stock - reserved_stock < safe_stock_threshold THEN 'RISK'
                       WHEN current_stock - reserved_stock < safe_stock_threshold * 2 THEN 'LOW'
                       ELSE 'ENOUGH'
                   END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE product_id = :productId
               AND store_id = :#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}
               AND current_stock >= :quantity
               AND reserved_stock >= :quantity
            """, nativeQuery = true)
    int shipReservedStock(@Param("productId") Long productId, @Param("quantity") int quantity);

    /** 取消或退款释放预留，不改变仓库实物库存。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE inventories
               SET reserved_stock = reserved_stock - :quantity,
                   inventory_status = CASE
                       WHEN current_stock - reserved_stock + :quantity < safe_stock_threshold THEN 'RISK'
                       WHEN current_stock - reserved_stock + :quantity < safe_stock_threshold * 2 THEN 'LOW'
                       ELSE 'ENOUGH'
                   END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE product_id = :productId
               AND store_id = :#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}
               AND reserved_stock >= :quantity
            """, nativeQuery = true)
    int releaseReservedStock(@Param("productId") Long productId, @Param("quantity") int quantity);

    /** 原子入库增加库存，避免入库与订单扣减并发时发生丢失更新。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE inventories
               SET current_stock = current_stock + :quantity,
                   inventory_status = CASE
                       WHEN current_stock + :quantity - reserved_stock < safe_stock_threshold THEN 'RISK'
                       WHEN current_stock + :quantity - reserved_stock < safe_stock_threshold * 2 THEN 'LOW'
                       ELSE 'ENOUGH'
                   END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE product_id = :productId
               AND store_id = :#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}
            """, nativeQuery = true)
    int incrementStock(@Param("productId") Long productId, @Param("quantity") int quantity);

    /** 带原因的人工盘点调整；不能低于现有预留量。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE inventories
               SET current_stock = :newStock,
                   inventory_status = CASE
                       WHEN :newStock - reserved_stock < safe_stock_threshold THEN 'RISK'
                       WHEN :newStock - reserved_stock < safe_stock_threshold * 2 THEN 'LOW'
                       ELSE 'ENOUGH'
                   END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE product_id = :productId
               AND store_id = :#{T(com.lth.ecommerceagent.tenant.TenantContext).storeId()}
               AND :newStock >= reserved_stock
            """, nativeQuery = true)
    int adjustCurrentStock(@Param("productId") Long productId, @Param("newStock") int newStock);
}
