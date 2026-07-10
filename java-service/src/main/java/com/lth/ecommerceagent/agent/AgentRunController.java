package com.lth.ecommerceagent.agent;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.operation.OperationPlan;
import com.lth.ecommerceagent.operation.OperationPlanRepository;

@RestController
@RequestMapping("/api/agent-runs")
public class AgentRunController {

    private final AgentRunRepository agentRunRepository;
    private final OperationPlanRepository operationPlanRepository;

    public AgentRunController(
            AgentRunRepository agentRunRepository,
            OperationPlanRepository operationPlanRepository) {
        this.agentRunRepository = agentRunRepository;
        this.operationPlanRepository = operationPlanRepository;
    }

    @PostMapping
    public ResponseEntity<AgentRunResponse> create(@RequestBody AgentRunCreateRequest request) {
        OperationPlan plan = findPlan(request.operationPlanId());
        AgentRun run = new AgentRun();
        apply(request, plan, run);
        AgentRun saved = agentRunRepository.save(run);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public List<AgentRunResponse> list() {
        return agentRunRepository.findAll().stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public AgentRunResponse get(@PathVariable Long id) {
        return toResponse(findRun(id));
    }

    @GetMapping("/by-operation-plan/{operationPlanId}")
    public List<AgentRunResponse> getByOperationPlan(@PathVariable Long operationPlanId) {
        return agentRunRepository.findByOperationPlanId(operationPlanId).stream()
                .map(this::toResponse)
                .toList();
    }

    private void apply(AgentRunCreateRequest request, OperationPlan plan, AgentRun run) {
        run.setTraceId(request.traceId());
        run.setOperationPlan(plan);
        run.setAgentName(request.agentName());
        run.setInputJson(request.inputJson());
        run.setOutputJson(request.outputJson());
        run.setStatus(request.status());
        run.setDurationMs(request.durationMs());
        run.setErrorMessage(request.errorMessage());
    }

    private OperationPlan findPlan(Long id) {
        return operationPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Operation plan not found: " + id));
    }

    private AgentRun findRun(Long id) {
        return agentRunRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agent run not found: " + id));
    }

    private AgentRunResponse toResponse(AgentRun r) {
        return new AgentRunResponse(
                r.getId(),
                r.getTraceId(),
                r.getOperationPlan().getId(),
                r.getAgentName(),
                r.getInputJson(),
                r.getOutputJson(),
                r.getStatus(),
                r.getDurationMs(),
                r.getErrorMessage(),
                r.getStartedAt(),
                r.getFinishedAt());
    }
}
