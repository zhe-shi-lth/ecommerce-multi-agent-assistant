-- 发货闭环新增失败态 SHIPPING_FAILED：调平台发货 API 失败后保留在「待重试」状态，
-- 与 READY_TO_SHIP / SHIPPED 同列，可于订单列表筛选「发货失败」批量处理。

-- 1) 扩展 orders.status 枚举
ALTER TABLE orders DROP CONSTRAINT ck_orders_status;
ALTER TABLE orders ADD CONSTRAINT ck_orders_status
    CHECK (status IN ('PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW', 'SHIPPED', 'REJECTED', 'SHIPPING_FAILED'));

-- 2) 扩展 fulfillment_suggestion_status 枚举（与 status 对齐，避免落库违反 CHECK）
ALTER TABLE orders DROP CONSTRAINT ck_orders_fulfillment_suggestion_status;
ALTER TABLE orders ADD CONSTRAINT ck_orders_fulfillment_suggestion_status
    CHECK (fulfillment_suggestion_status IN ('PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW', 'SHIPPED', 'REJECTED', 'SHIPPING_FAILED'));
