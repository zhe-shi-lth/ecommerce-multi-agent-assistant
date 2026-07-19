-- 阶段 12：当前运营计划 / 订单 / 日销等数据均尚未挂接平台，统一清空，
-- 由用户重新按平台（淘宝/抖音/小红书）造数，确保分平台测试从干净状态开始。
-- 删除顺序遵循外键依赖：agent_runs -> operation_plans -> orders；daily_sales 无关联可独立删。

DELETE FROM agent_runs;
DELETE FROM operation_plans;
DELETE FROM orders;
DELETE FROM daily_sales;
