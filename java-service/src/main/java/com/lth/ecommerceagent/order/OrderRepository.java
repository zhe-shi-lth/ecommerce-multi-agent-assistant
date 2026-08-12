package com.lth.ecommerceagent.order;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o join fetch o.product where o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    @Override
    @EntityGraph(attributePaths = "product")
    List<Order> findAll();

    @Override
    @EntityGraph(attributePaths = "product")
    Optional<Order> findById(Long id);

    Optional<Order> findByProductId(Long productId);

    // 库存不足订单批量「重新判定」：取全部 INSUFFICIENT_STOCK 订单。
    List<Order> findByStatus(String status);

    // 某商品的库存不足订单（销售监控单商品「补货并重新判定」用）。
    @org.springframework.data.jpa.repository.Query(
            "SELECT o FROM Order o WHERE o.status = :status AND o.product.id = :productId")
    List<Order> findByStatusAndProductId(
            @org.springframework.data.repository.query.Param("status") String status,
            @org.springframework.data.repository.query.Param("productId") Long productId);

    // 真实拉单幂等：同一平台同一单号已入库则跳过，重复同步不会产生重复订单。
    boolean existsByPlatformAndPlatformOrderId(String platform, String platformOrderId);

    // 地址补全定时轮询：取「待分析 + 地址未补全」的订单（带商品，便于重算履约状态）。
    // 用显式 JPQL：Spring Data 的 False 关键字会吞掉显式 boolean 参数，导致派生查询只绑定 1 个参数。
    @EntityGraph(attributePaths = "product")
    @Query("SELECT o FROM Order o WHERE o.status = :status AND o.addressComplete = :addressComplete")
    List<Order> findByStatusAndAddressCompleteFalse(
            @Param("status") String status,
            @Param("addressComplete") boolean addressComplete);

    // 付款定时轮询：取「待分析 + 未付款」的订单（带商品，便于重算履约状态），对称地址轮询。
    @EntityGraph(attributePaths = "product")
    @Query("SELECT o FROM Order o WHERE o.status = :status AND o.paid = :paid")
    List<Order> findByStatusAndPaidFalse(
            @Param("status") String status,
            @Param("paid") boolean paid);

    // 超时升级：取「待分析 +（地址未补全 或 未付款）+ 创建时间早于 before」的订单（超龄仍未处理）。
    // 统一覆盖地址不全与未付款两类，避免纯未付款单卡死在待分析；保留 pendingReason 以区分来源。
    @Query("SELECT o FROM Order o WHERE o.status = :status AND o.createdAt < :before "
            + "AND (o.addressComplete = false OR o.paid = false)")
    List<Order> findOverduePendingAnalysis(
            @Param("status") String status,
            @Param("before") java.time.Instant before);

    // 库存不足订单按商品汇总：积压销量合计 + 订单笔数（currentStock/shortQuantity 由调用方回填）。
    @Query("SELECT new com.lth.ecommerceagent.order.InsufficientStockSummary("
            + " o.product.id, o.product.name, SUM(o.quantity), COUNT(o))"
            + " FROM Order o WHERE o.status = 'INSUFFICIENT_STOCK' GROUP BY o.product.id, o.product.name")
    List<InsufficientStockSummary> summarizeInsufficientStock();
}
