package com.lth.ecommerceagent.agent;

import java.time.Instant;
import java.util.Map;

public record AgentRunResponse(
        Long id,
        String traceId,
        Long operationPlanId,
        String agentName,
        Map<String, Object> inputJson,
        Map<String, Object> outputJson,
        String status,
        Integer durationMs,
        String errorMessage,
        Instant startedAt,
        Instant finishedAt) {
}
