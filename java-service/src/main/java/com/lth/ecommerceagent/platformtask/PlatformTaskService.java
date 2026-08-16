package com.lth.ecommerceagent.platformtask;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlatformTaskService {
    private final PlatformTaskRepository repository;
    private final TransactionTemplate transactionTemplate;

    public PlatformTaskService(PlatformTaskRepository repository, PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PlatformTask begin(String key, String action, String entityType, Long entityId,
            String platform, Map<String, Object> request) {
        PlatformTask existing = repository.findByIdempotencyKey(key).orElse(null);
        if (existing != null) {
            return existing;
        }
        PlatformTask task = new PlatformTask();
        task.setIdempotencyKey(key);
        task.setActionType(action);
        task.setEntityType(entityType);
        task.setEntityId(entityId);
        task.setPlatform(platform);
        task.setStatus("PENDING");
        task.setRequestJson(request);
        try {
            return repository.saveAndFlush(task);
        } catch (DataIntegrityViolationException exception) {
            return repository.findByIdempotencyKey(key).orElseThrow();
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PlatformTask markRunning(Long id) {
        PlatformTask task = locked(id);
        if (List.of("COMPLETED", "EXTERNAL_SUCCEEDED").contains(task.getStatus())) {
            return task;
        }
        if ("RUNNING".equals(task.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Platform task is already running");
        }
        if (!List.of("PENDING", "FAILED").contains(task.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Platform task cannot be started from status " + task.getStatus());
        }
        task.setStatus("RUNNING");
        task.setAttemptCount(task.getAttemptCount() + 1);
        task.setLastError(null);
        task.setNextRetryAt(null);
        return repository.save(task);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PlatformTask externalSucceeded(Long id, Map<String, Object> response) {
        PlatformTask task = locked(id);
        task.setStatus("EXTERNAL_SUCCEEDED");
        task.setResponseJson(response);
        task.setExternalSucceededAt(Instant.now());
        task.setLastError(null);
        return repository.save(task);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completed(Long id) {
        PlatformTask task = locked(id);
        task.setStatus("COMPLETED");
        task.setCompletedAt(Instant.now());
        task.setNextRetryAt(null);
        repository.save(task);
    }

    public void completeAfterCommit(Long id, String rollbackMessage) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            completed(id);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                transactionTemplate.executeWithoutResult(ignored -> {
                    if (status == STATUS_COMMITTED) {
                        completed(id);
                    } else {
                        needsReconciliation(id, rollbackMessage);
                    }
                });
            }
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failed(Long id, String error) {
        PlatformTask task = locked(id);
        task.setStatus("FAILED");
        task.setLastError(abbreviate(error == null ? "Unknown platform error" : error));
        long delayMinutes = Math.min(30, 1L << Math.min(5, task.getAttemptCount()));
        task.setNextRetryAt(Instant.now().plus(delayMinutes, ChronoUnit.MINUTES));
        repository.save(task);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void needsReconciliation(Long id, String error) {
        PlatformTask task = locked(id);
        task.setStatus("NEEDS_RECONCILIATION");
        task.setLastError(abbreviate(error));
        repository.save(task);
    }

    @Transactional(readOnly = true)
    public PlatformTask findByKey(String key) {
        return repository.findByIdempotencyKey(key).orElse(null);
    }

    @Transactional(readOnly = true)
    public List<PlatformTaskResponse> list(String entityType, Long entityId, String status) {
        List<PlatformTask> rows = entityType != null && entityId != null
                ? repository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId)
                : status != null ? repository.findVisibleByStatus(status) : repository.findVisibleAll();
        return rows.stream().map(PlatformTaskResponse::from).toList();
    }

    @Transactional
    public PlatformTask retry(Long id) {
        PlatformTask task = locked(id);
        if (!List.of("FAILED", "NEEDS_RECONCILIATION").contains(task.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only failed or reconciliation tasks can be retried");
        }
        boolean externalAlreadySucceeded = "NEEDS_RECONCILIATION".equals(task.getStatus())
                && task.getExternalSucceededAt() != null;
        task.setStatus(externalAlreadySucceeded ? "EXTERNAL_SUCCEEDED" : "FAILED");
        if (!externalAlreadySucceeded) {
            task.setAttemptCount(Math.min(task.getAttemptCount(), task.getMaxAttempts() - 1));
        }
        task.setNextRetryAt(Instant.now());
        return repository.save(task);
    }

    @Transactional(readOnly = true)
    public List<PlatformTask> retryable(Instant now) {
        return repository.findRetryable(now);
    }

    @Transactional(readOnly = true)
    public List<PlatformTask> staleRunning(Instant before) {
        return repository.findStaleRunning(before);
    }

    private PlatformTask locked(Long id) {
        return repository.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Platform task not found"));
    }

    private String abbreviate(String value) {
        if (value == null) {
            return null;
        }
        return value.substring(0, Math.min(1500, value.length()));
    }
}
