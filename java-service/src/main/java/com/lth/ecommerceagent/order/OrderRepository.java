package com.lth.ecommerceagent.order;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @Override
    @EntityGraph(attributePaths = "product")
    List<Order> findAll();

    @Override
    @EntityGraph(attributePaths = "product")
    Optional<Order> findById(Long id);

    Optional<Order> findByProductId(Long productId);

    // 真实拉单幂等：同一平台同一单号已入库则跳过，重复同步不会产生重复订单。
    boolean existsByPlatformAndPlatformOrderId(String platform, String platformOrderId);
}
