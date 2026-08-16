package com.lth.ecommerceagent.platformtask;

import java.time.Instant;
import java.util.Map;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "platform_tasks")
public class PlatformTask {
    @Column(name="company_id", nullable=false) private Long companyId;
    @Column(name="store_id", nullable=false) private Long storeId;
    @jakarta.persistence.PrePersist void assignTenant(){if(companyId==null)companyId=com.lth.ecommerceagent.tenant.TenantContext.companyId();if(storeId==null)storeId=com.lth.ecommerceagent.tenant.TenantContext.storeId();}
    public Long getCompanyId(){return companyId;} public Long getStoreId(){return storeId;}
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="idempotency_key",nullable=false,unique=true,length=180) private String idempotencyKey;
    @Column(name="action_type",nullable=false,length=30) private String actionType;
    @Column(name="entity_type",nullable=false,length=30) private String entityType;
    @Column(name="entity_id",nullable=false) private Long entityId;
    @Column(nullable=false,length=20) private String platform;
    @Column(nullable=false,length=30) private String status;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="request_json",nullable=false) private Map<String,Object> requestJson;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="response_json") private Map<String,Object> responseJson;
    @Column(name="attempt_count",nullable=false) private Integer attemptCount=0;
    @Column(name="max_attempts",nullable=false) private Integer maxAttempts=3;
    @Column(name="last_error",length=1500) private String lastError;
    @Column(name="next_retry_at") private Instant nextRetryAt;
    @Column(name="external_succeeded_at") private Instant externalSucceededAt;
    @Column(name="completed_at") private Instant completedAt;
    @Version @Column(nullable=false) private Long version;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @UpdateTimestamp @Column(name="updated_at",nullable=false) private Instant updatedAt;
    public Long getId(){return id;} public String getIdempotencyKey(){return idempotencyKey;} public void setIdempotencyKey(String v){idempotencyKey=v;}
    public String getActionType(){return actionType;} public void setActionType(String v){actionType=v;} public String getEntityType(){return entityType;} public void setEntityType(String v){entityType=v;}
    public Long getEntityId(){return entityId;} public void setEntityId(Long v){entityId=v;} public String getPlatform(){return platform;} public void setPlatform(String v){platform=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;} public Map<String,Object> getRequestJson(){return requestJson;} public void setRequestJson(Map<String,Object> v){requestJson=v;}
    public Map<String,Object> getResponseJson(){return responseJson;} public void setResponseJson(Map<String,Object> v){responseJson=v;} public Integer getAttemptCount(){return attemptCount;} public void setAttemptCount(Integer v){attemptCount=v;}
    public Integer getMaxAttempts(){return maxAttempts;} public void setMaxAttempts(Integer v){maxAttempts=v;} public String getLastError(){return lastError;} public void setLastError(String v){lastError=v;}
    public Instant getNextRetryAt(){return nextRetryAt;} public void setNextRetryAt(Instant v){nextRetryAt=v;} public Instant getExternalSucceededAt(){return externalSucceededAt;} public void setExternalSucceededAt(Instant v){externalSucceededAt=v;}
    public Instant getCompletedAt(){return completedAt;} public void setCompletedAt(Instant v){completedAt=v;} public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
}
