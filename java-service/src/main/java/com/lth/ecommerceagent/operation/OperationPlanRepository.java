package com.lth.ecommerceagent.operation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

public interface OperationPlanRepository extends JpaRepository<OperationPlan, Long> {

    @Override
    @EntityGraph(attributePaths = {"product", "order"})
    List<OperationPlan> findAll();

    @Override
    @EntityGraph(attributePaths = {"product", "order"})
    Optional<OperationPlan> findById(Long id);

    @EntityGraph(attributePaths = {"product", "order"})
    Optional<OperationPlan> findByTraceId(String traceId);
}
