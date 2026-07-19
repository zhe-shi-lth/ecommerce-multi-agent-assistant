-- 阶段 9：引入多平台维度（taobao / douyin / xiaohongshu）。
-- 订单、运营计划、日销均增加 platform 列，订单与计划缺省归到 taobao（兼容旧种子数据）；
-- 日销唯一约束由 (product_id, sale_date) 升级为 (product_id, platform, sale_date)，以支持分平台统计。

ALTER TABLE orders ADD COLUMN platform varchar(20) NOT NULL DEFAULT 'taobao';
ALTER TABLE operation_plans ADD COLUMN platform varchar(20) NOT NULL DEFAULT 'taobao';

ALTER TABLE daily_sales ADD COLUMN platform varchar(20) NOT NULL DEFAULT 'taobao';
-- 先去掉旧唯一约束，再按 (商品 + 平台 + 日期) 重建，避免平台维度重复聚合。
ALTER TABLE daily_sales DROP CONSTRAINT uk_daily_sales_product_date;
ALTER TABLE daily_sales ADD CONSTRAINT uk_daily_sales_product_platform_date
    UNIQUE (product_id, platform, sale_date);
