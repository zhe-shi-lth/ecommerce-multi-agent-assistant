-- 线1（新品上架流水线）：运营计划区分业务线，且上架阶段尚无订单，故 order_id 可空。
-- 1) 原主管一次性生成的计划统一归为 LINE2_MONITOR（含库存/履约）。
-- 2) order_id 改为可空，支持无订单的上架计划。

ALTER TABLE operation_plans ADD COLUMN line VARCHAR(40);
UPDATE operation_plans SET line = 'LINE2_MONITOR' WHERE line IS NULL;

ALTER TABLE operation_plans ALTER COLUMN order_id DROP NOT NULL;
