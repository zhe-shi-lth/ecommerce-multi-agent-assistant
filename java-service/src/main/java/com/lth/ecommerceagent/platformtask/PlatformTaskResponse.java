package com.lth.ecommerceagent.platformtask;
import java.time.Instant; import java.util.Map;
public record PlatformTaskResponse(Long id,String idempotencyKey,String actionType,String entityType,Long entityId,String platform,String status,Map<String,Object> requestJson,Map<String,Object> responseJson,Integer attemptCount,Integer maxAttempts,String lastError,Instant nextRetryAt,Instant externalSucceededAt,Instant completedAt,Instant createdAt,Instant updatedAt){
 static PlatformTaskResponse from(PlatformTask t){return new PlatformTaskResponse(t.getId(),t.getIdempotencyKey(),t.getActionType(),t.getEntityType(),t.getEntityId(),t.getPlatform(),t.getStatus(),t.getRequestJson(),t.getResponseJson(),t.getAttemptCount(),t.getMaxAttempts(),t.getLastError(),t.getNextRetryAt(),t.getExternalSucceededAt(),t.getCompletedAt(),t.getCreatedAt(),t.getUpdatedAt());}
}
