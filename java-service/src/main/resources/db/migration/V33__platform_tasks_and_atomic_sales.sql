CREATE TABLE platform_tasks (
    id BIGSERIAL PRIMARY KEY,
    idempotency_key VARCHAR(180) NOT NULL UNIQUE,
    action_type VARCHAR(30) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    request_json JSONB NOT NULL,
    response_json JSONB,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error VARCHAR(1500),
    next_retry_at TIMESTAMPTZ,
    external_succeeded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_platform_task_action CHECK (action_type IN ('PUBLISH','UNPUBLISH','SHIP','PULL_ORDERS','REFUND')),
    CONSTRAINT ck_platform_task_status CHECK (status IN ('PENDING','RUNNING','EXTERNAL_SUCCEEDED','COMPLETED','FAILED','NEEDS_RECONCILIATION')),
    CONSTRAINT ck_platform_task_attempts CHECK (attempt_count >= 0 AND max_attempts > 0)
);
CREATE INDEX idx_platform_tasks_status_retry ON platform_tasks(status, next_retry_at);
CREATE INDEX idx_platform_tasks_entity ON platform_tasks(entity_type, entity_id, created_at);

ALTER TABLE daily_sales DROP CONSTRAINT IF EXISTS uk_daily_sales_product_platform_date;
ALTER TABLE daily_sales ADD CONSTRAINT uk_daily_sales_product_platform_date
    UNIQUE (product_id, platform, sale_date);
