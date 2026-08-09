-- 地址补全闭环：在 orders 表记录最近一次履约 Agent 重算的履约结论快照。
ALTER TABLE orders
    ADD COLUMN fulfillment_plan_json JSONB;
