package com.lth.ecommerceagent.operation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;

public interface OperationPlanRepository extends JpaRepository<OperationPlan, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from OperationPlan p join fetch p.product where p.id = :id")
    Optional<OperationPlan> findByIdForUpdate(@Param("id") Long id);

    @Override
    @EntityGraph(attributePaths = {"product", "order"})
    List<OperationPlan> findAll();

    @Override
    @EntityGraph(attributePaths = {"product", "order"})
    Optional<OperationPlan> findById(Long id);

    @EntityGraph(attributePaths = {"product", "order"})
    Optional<OperationPlan> findByTraceId(String traceId);

    // 模拟拉单：只针对「已确认(CONFIRMED)」的运营计划——计划才代表商品已真正在某平台上架。
    @EntityGraph(attributePaths = {"product", "order"})
    List<OperationPlan> findByConfirmationStatus(String confirmationStatus);

    @EntityGraph(attributePaths = {"product", "order"})
    List<OperationPlan> findByConfirmationStatusAndPlatform(String confirmationStatus, String platform);
}
