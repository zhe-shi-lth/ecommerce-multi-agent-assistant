-- 阶段 11：平台仅保留三个真实平台（淘宝/抖音/小红书）。
-- 清除历史 / 未指定平台的数据（含其执行记录），由用户重新按平台造数。
-- 删除顺序遵循外键依赖：agent_runs -> operation_plans -> orders；daily_sales 无关联可独立删。

DELETE FROM agent_runs
WHERE operation_plan_id IN (
  SELECT id FROM operation_plans WHERE platform NOT IN ('taobao', 'douyin', 'xiaohongshu')
);

DELETE FROM operation_plans WHERE platform NOT IN ('taobao', 'douyin', 'xiaohongshu');
DELETE FROM orders WHERE platform NOT IN ('taobao', 'douyin', 'xiaohongshu');
DELETE FROM daily_sales WHERE platform NOT IN ('taobao', 'douyin', 'xiaohongshu');
