package com.lth.ecommerceagent.operation;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationPlanRepository extends JpaRepository<OperationPlan, Long> {

    Optional<OperationPlan> findByTraceId(String traceId);
}
