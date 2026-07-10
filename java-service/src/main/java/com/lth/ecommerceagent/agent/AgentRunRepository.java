package com.lth.ecommerceagent.agent;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

public interface AgentRunRepository extends JpaRepository<AgentRun, Long> {

    @Override
    @EntityGraph(attributePaths = "operationPlan")
    List<AgentRun> findAll();

    @Override
    @EntityGraph(attributePaths = "operationPlan")
    Optional<AgentRun> findById(Long id);

    @EntityGraph(attributePaths = "operationPlan")
    List<AgentRun> findByOperationPlanId(Long operationPlanId);
}
