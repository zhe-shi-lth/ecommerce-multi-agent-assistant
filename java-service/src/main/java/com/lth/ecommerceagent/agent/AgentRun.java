package com.lth.ecommerceagent.agent;

import java.time.Instant;
import java.util.Map;

import com.lth.ecommerceagent.operation.OperationPlan;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "agent_runs")
public class AgentRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trace_id", nullable = false, length = 80)
    private String traceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operation_plan_id", nullable = false)
    private OperationPlan operationPlan;

    @Column(name = "agent_name", nullable = false, length = 80)
    private String agentName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_json", nullable = false)
    private Map<String, Object> inputJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_json", nullable = false)
    private Map<String, Object> outputJson;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "duration_ms", nullable = false)
    private Integer durationMs;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @UpdateTimestamp
    @Column(name = "finished_at", nullable = false)
    private Instant finishedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public OperationPlan getOperationPlan() {
        return operationPlan;
    }

    public void setOperationPlan(OperationPlan operationPlan) {
        this.operationPlan = operationPlan;
    }

    public String getAgentName() {
        return agentName;
    }

    public void setAgentName(String agentName) {
        this.agentName = agentName;
    }

    public Map<String, Object> getInputJson() {
        return inputJson;
    }

    public void setInputJson(Map<String, Object> inputJson) {
        this.inputJson = inputJson;
    }

    public Map<String, Object> getOutputJson() {
        return outputJson;
    }

    public void setOutputJson(Map<String, Object> outputJson) {
        this.outputJson = outputJson;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Integer durationMs) {
        this.durationMs = durationMs;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }
}
