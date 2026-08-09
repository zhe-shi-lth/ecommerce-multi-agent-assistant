-- 订单履约终态：SHIPPED（已发货）+ REJECTED（审核驳回，不履约）。
-- 同时补 shipped_at 发货时间，供订单详情/追溯展示。

-- 1) 扩展 orders.status 枚举
ALTER TABLE orders DROP CONSTRAINT ck_orders_status;
ALTER TABLE orders ADD CONSTRAINT ck_orders_status
    CHECK (status IN ('PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW', 'SHIPPED', 'REJECTED'));

-- 2) 扩展 fulfillment_suggestion_status 枚举（与 status 对齐，避免落库违反 CHECK）
ALTER TABLE orders DROP CONSTRAINT ck_orders_fulfillment_suggestion_status;
ALTER TABLE orders ADD CONSTRAINT ck_orders_fulfillment_suggestion_status
    CHECK (fulfillment_suggestion_status IN ('PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW', 'SHIPPED', 'REJECTED'));

-- 3) 发货时间（仅 SHIPPED 态有值）
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;
