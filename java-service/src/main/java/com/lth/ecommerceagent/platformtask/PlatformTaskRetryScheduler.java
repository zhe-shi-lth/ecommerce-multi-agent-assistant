package com.lth.ecommerceagent.platformtask;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lth.ecommerceagent.operation.OperationPlanController;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderCompletionService;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.order.ShipRequest;

@Component
public class PlatformTaskRetryScheduler {
    private static final Logger log = LoggerFactory.getLogger(PlatformTaskRetryScheduler.class);
    private final PlatformTaskService taskService;
    private final OperationPlanController operationPlanController;
    private final OrderCompletionService orderCompletionService;
    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;

    public PlatformTaskRetryScheduler(
            PlatformTaskService taskService,
            @Lazy OperationPlanController operationPlanController,
            @Lazy OrderCompletionService orderCompletionService,
            OrderRepository orderRepository,
            ObjectMapper objectMapper) {
        this.taskService = taskService;
        this.operationPlanController = operationPlanController;
        this.orderCompletionService = orderCompletionService;
        this.orderRepository = orderRepository;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedDelayString = "${platform-task.retry.fixed-delay-ms:30000}")
    public void retryDueTasks() {
        taskService.retryable(Instant.now()).stream().limit(20).forEach(task ->
                com.lth.ecommerceagent.tenant.TenantContext.runAsSystem(task.getCompanyId(),task.getStoreId(),()->dispatch(task)));
    }

    @Scheduled(fixedDelayString = "${platform-task.reconciliation.fixed-delay-ms:60000}")
    public void markStaleTasks() {
        Instant before = Instant.now().minus(10, ChronoUnit.MINUTES);
        taskService.staleRunning(before).stream().limit(100).forEach(task ->
                com.lth.ecommerceagent.tenant.TenantContext.runAsSystem(task.getCompanyId(),task.getStoreId(),()->
                    taskService.needsReconciliation(task.getId(),
                        "Task remained RUNNING for more than 10 minutes; manual reconciliation is required")));
    }

    private void dispatch(PlatformTask task) {
        try {
            switch (task.getActionType()) {
                case "PUBLISH" -> operationPlanController.confirm(task.getEntityId());
                case "SHIP" -> {
                    Order order = orderRepository.findById(task.getEntityId()).orElseThrow();
                    ShipRequest request = objectMapper.convertValue(task.getRequestJson(), ShipRequest.class);
                    orderCompletionService.ship(order, request);
                }
                default -> taskService.needsReconciliation(task.getId(),
                        "No automatic retry dispatcher for action " + task.getActionType());
            }
        } catch (RuntimeException exception) {
            log.warn("Platform task retry failed: taskId={}, action={}",
                    task.getId(), task.getActionType(), exception);
        }
    }
}
