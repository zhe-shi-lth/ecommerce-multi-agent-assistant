package com.lth.ecommerceagent.platformtask;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
class PlatformTaskServiceTests {
    @Autowired PlatformTaskService service;
    @Autowired PlatformTaskRepository repository;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;

    @Test
    void idempotencyKeyReturnsSingleTask() {
        PlatformTask first = service.begin("TEST:PUBLISH:1", "PUBLISH", "OPERATION_PLAN", 1L,
                "taobao", Map.of("name", "item"));
        PlatformTask second = service.begin("TEST:PUBLISH:1", "PUBLISH", "OPERATION_PLAN", 1L,
                "taobao", Map.of("name", "item"));
        assertThat(second.getId()).isEqualTo(first.getId());
    }

    @Test
    void completionIsRecordedOnlyAfterBusinessCommit() {
        PlatformTask task = service.begin("TEST:SHIP:2", "SHIP", "ORDER", 2L,
                "douyin", Map.of("shippingFee", 0));
        new TransactionTemplate(transactionManager).executeWithoutResult(ignored ->
                service.completeAfterCommit(task.getId(), "rollback"));
        assertThat(repository.findById(task.getId()).orElseThrow().getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void rollbackMovesExternallySucceededTaskToReconciliation() {
        PlatformTask task = service.begin("TEST:PUBLISH:ROLLBACK", "PUBLISH", "OPERATION_PLAN", 4L,
                "taobao", Map.of("name", "item"));
        service.externalSucceeded(task.getId(), Map.of("externalItemId", "ext-4"));
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.executeWithoutResult(status -> {
            service.completeAfterCommit(task.getId(), "business rollback");
            status.setRollbackOnly();
        });
        PlatformTask saved = repository.findById(task.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo("NEEDS_RECONCILIATION");
        assertThat(saved.getLastError()).isEqualTo("business rollback");
    }

    @Test
    void manualRetryMakesFailedTaskImmediatelyDue() {
        PlatformTask task = service.begin("TEST:SHIP:3", "SHIP", "ORDER", 3L,
                "xiaohongshu", Map.of("shippingFee", 0));
        service.markRunning(task.getId());
        service.failed(task.getId(), "timeout");
        PlatformTask queued = service.retry(task.getId());
        assertThat(queued.getStatus()).isEqualTo("FAILED");
        assertThat(queued.getNextRetryAt()).isBeforeOrEqualTo(Instant.now());
    }

    @Test
    void reconciliationRetryReusesExternalSuccessInsteadOfCallingPlatformAgain() {
        PlatformTask task = service.begin("TEST:PUBLISH:RECONCILE", "PUBLISH", "OPERATION_PLAN", 5L,
                "douyin", Map.of("name", "item"));
        service.externalSucceeded(task.getId(), Map.of("externalItemId", "ext-5"));
        service.needsReconciliation(task.getId(), "local write failed");

        PlatformTask queued = service.retry(task.getId());

        assertThat(queued.getStatus()).isEqualTo("EXTERNAL_SUCCEEDED");
        assertThat(queued.getResponseJson()).containsEntry("externalItemId", "ext-5");
        assertThat(service.retryable(Instant.now().plusSeconds(1)))
                .extracting(PlatformTask::getId)
                .contains(task.getId());
    }

    @Test
    void runningTaskCannotBeClaimedTwice() {
        PlatformTask task = service.begin("TEST:SHIP:CLAIM", "SHIP", "ORDER", 6L,
                "taobao", Map.of("shippingFee", 0));
        service.markRunning(task.getId());

        assertThatThrownBy(() -> service.markRunning(task.getId()))
                .hasMessageContaining("already running");
        assertThat(repository.findById(task.getId()).orElseThrow().getAttemptCount()).isEqualTo(1);
    }
}
