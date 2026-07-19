-- 阶段 10：平台改为可选维度。
-- 阶段 9 把历史数据默认归到了 taobao，现统一标记为 unspecified（未指定），
-- 即「之前的数据不属于任何平台」。后续由模拟器 / 新品上架按真实平台写入。
UPDATE orders SET platform = 'unspecified' WHERE platform IS DISTINCT FROM 'unspecified';
UPDATE operation_plans SET platform = 'unspecified' WHERE platform IS DISTINCT FROM 'unspecified';
UPDATE daily_sales SET platform = 'unspecified' WHERE platform IS DISTINCT FROM 'unspecified';

-- 后续新增行（未显式指定平台时）默认 unspecified，而非强制 taobao。
ALTER TABLE orders ALTER COLUMN platform SET DEFAULT 'unspecified';
ALTER TABLE operation_plans ALTER COLUMN platform SET DEFAULT 'unspecified';
ALTER TABLE daily_sales ALTER COLUMN platform SET DEFAULT 'unspecified';
