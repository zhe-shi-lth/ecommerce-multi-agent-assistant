-- 订单来源溯源：平台原始单号 + 数据来源标记。
--
-- 目的：让「模拟订单」与「真实平台拉取的订单」在库里形状完全一致，
-- 切换到真实平台后，页面、Agent、履约逻辑都无需再改读取方式。
--   platform_order_id：平台侧的订单号（商家在平台后台看到的那个号）。
--                      模拟数据也会有，形如 MOCK000000000123。
--   source           ：mock=本地模拟造数；real=平台开放 API 拉取。

ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_order_id VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'mock';

-- 历史订单回填：用主键生成稳定单号，避免唯一索引建不起来。
UPDATE orders
SET platform_order_id = 'MOCK' || LPAD(id::text, 12, '0')
WHERE platform_order_id IS NULL OR platform_order_id = '';

ALTER TABLE orders ALTER COLUMN platform_order_id SET NOT NULL;

-- 同一平台下单号唯一：真实拉单重复同步时用于幂等去重（已入库的订单不会再建一条）。
CREATE UNIQUE INDEX IF NOT EXISTS uk_orders_platform_order_id
    ON orders (platform, platform_order_id);
