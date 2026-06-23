package com.lth.ecommerceagent.agent;

import java.util.Map;

public record AgentRunCreateRequest(
        String traceId,
        Long operationPlanId,
        String agentName,
        Map<String, Object> inputJson,
        Map<String, Object> outputJson,
        String status,
        Integer durationMs,
        String errorMessage) {
}
