-- 步骤 6：运营计划人工确认/驳回所需字段。
-- confirmation_status 独立存储人工确认结果，不影响原有 status 的 CHECK 约束。
ALTER TABLE operation_plans
    ADD COLUMN confirmation_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN confirmed_at TIMESTAMPTZ;
