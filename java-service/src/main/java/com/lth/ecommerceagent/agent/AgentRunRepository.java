package com.lth.ecommerceagent.agent;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRunRepository extends JpaRepository<AgentRun, Long> {

    List<AgentRun> findByOperationPlanId(Long operationPlanId);
}
