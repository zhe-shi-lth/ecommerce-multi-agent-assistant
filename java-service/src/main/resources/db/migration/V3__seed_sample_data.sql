-- 阶段 7：示例数据（演示用）。首次启动后前端即有可浏览的商品/库存/订单与一条运营计划（含 trace），
-- 可直接演示「确认/驳回」与 Agent 执行轨迹，无需先跑编排。
-- 注意：operation_plans / agent_runs 的 JSON 仅作展示样例，结构与实际 Agent 输出一致。

-- 商品（幂等：已存在相同 id 则跳过，避免在本机已有数据的库上主键冲突导致启动失败）
INSERT INTO products (id, name, category, description, cost_price, sale_price, target_audience, usage_scenario, status)
VALUES
  (1, '便携榨汁杯 Pro', '小家电', '适合办公室和健身房使用的小型榨汁杯，Type-C 充电', 39.0, 89.0, '上班族、健身人群、学生', '办公室、健身房、宿舍、旅行', 'ANALYZED'),
  (2, '不锈钢保温杯', 'Home', '316 不锈钢真空保温杯，长效保温保冷', 25.0, 59.0, '通勤族、学生、户外', '通勤、办公、户外', 'ANALYZED'),
  (3, '无线降噪耳机', 'Audio', '入门级主动降噪耳机，续航 30 小时', 99.0, 199.0, '学生、年轻白领', '通勤、学习、运动', 'ANALYZED')
ON CONFLICT (id) DO NOTHING;

-- 库存
INSERT INTO inventories (product_id, current_stock, reserved_stock, safe_stock_threshold, purchase_cycle_days, sales_last_7_days, inventory_status)
VALUES
  (1, 18, 5, 20, 5, 32, 'LOW'),
  (2, 120, 10, 50, 14, 40, 'ENOUGH'),
  (3, 3, 0, 10, 7, 15, 'RISK')
ON CONFLICT (product_id) DO NOTHING;

-- 订单（覆盖：正常可发 / 需补货 / 高风险需售后 三种典型场景）
INSERT INTO orders (id, product_id, quantity, status, address_complete, paid, manual_review_required, fulfillment_suggestion_status)
VALUES
  (1, 1, 2, 'PENDING_ANALYSIS', true, true, false, 'PENDING_ANALYSIS'),
  (2, 2, 2, 'PENDING_ANALYSIS', true, true, false, 'PENDING_ANALYSIS'),
  (3, 3, 5, 'PENDING_ANALYSIS', false, false, true, 'PENDING_ANALYSIS')
ON CONFLICT (id) DO NOTHING;

-- 一条示例运营计划（含完整 trace），便于直接演示确认/驳回与轨迹查看
INSERT INTO operation_plans (id, trace_id, product_id, order_id, product_plan_json, image_plan_json, inventory_plan_json, fulfillment_plan_json, final_summary, manual_review_required, status)
VALUES (
  1,
  'seed_trace_001',
  1,
  1,
  '{"recommended_title":"便携榨汁杯 Pro","selling_points":["便携充电","大容量杯体"],"detail_description":"Type-C 充电、随行榨汁。","target_user_summary":"上班族与健身人群","listing_suggestion":"详情页强调便携与一键清洗","seo_keywords":["榨汁杯","便携榨汁"],"meta_description":"便携榨汁杯 Pro，随行新鲜。","platform_copies":{"taobao":"便携榨汁杯 Pro 大容量","douyin":"健身必备榨汁杯","xiaohongshu":"通勤党最爱榨汁杯"}}',
  '{"main_image_prompt":"白底展示榨汁杯","scene_image_prompt":"健身房场景使用","marketing_image_prompt":"促销主视觉","image_style":"电商白底","image_risk_notes":["避免夸大功效"],"image_review_result":{"overall_score":92,"risk_level":"低风险","issues":[],"suggestions":["可直接使用"],"reviewer":"rule"}}',
  '{"inventory_status":"RISK","should_restock":true,"suggested_restock_quantity":32,"restock_priority":"HIGH","reason":"可用库存 13，预计售罄 2 天。","daily_demand":4.57,"available_stock":13,"projected_stock":11,"purchase_cycle_days":5,"days_to_stockout":2,"required_coverage":42.86}',
  '{"can_ship":false,"fulfillment_status":"NEEDS_REVIEW","risk_flags":["可用库存不足"],"manual_review_required":true,"next_order_status":"NEEDS_REVIEW","logistics_risk_level":"HIGH","anomaly_details":["可用库存不足（13 < 订单量 2 的覆盖）"],"suggested_actions":["优先调拨库存或加急采购"],"after_sale_suggested":true,"after_sale_reason":"物流风险较高，建议售后提前介入跟进客户与物流异常"}',
  '触发类型 MANUAL。商品建议标题为：便携榨汁杯 Pro。图片风格建议为：电商白底。库存状态为：RISK，补货优先级为：HIGH。订单下一步建议状态为：NEEDS_REVIEW。',
  true,
  'SUCCESS'
)
ON CONFLICT (id) DO NOTHING;

-- 对应的 Agent 执行记录（supervisor + 4 个 Agent）
INSERT INTO agent_runs (id, trace_id, operation_plan_id, agent_name, input_json, output_json, status, duration_ms)
VALUES
  (1, 'seed_trace_001', 1, 'SUPERVISOR_AGENT', '{"note":"编排开始"}', '{"status":"SUCCESS"}', 'SUCCESS', 3),
  (2, 'seed_trace_001', 1, 'PRODUCT_PLANNING_AGENT', '{"product_id":1}', '{"recommended_title":"便携榨汁杯 Pro"}', 'SUCCESS', 12),
  (3, 'seed_trace_001', 1, 'IMAGE_CREATIVE_AGENT', '{"product_id":1}', '{"image_style":"电商白底","image_review_result":{"overall_score":92,"reviewer":"rule"}}', 'SUCCESS', 9),
  (4, 'seed_trace_001', 1, 'INVENTORY_PURCHASE_AGENT', '{"product_id":1}', '{"inventory_status":"RISK","should_restock":true}', 'SUCCESS', 7),
  (5, 'seed_trace_001', 1, 'ORDER_FULFILLMENT_AGENT', '{"product_id":1}', '{"can_ship":false,"logistics_risk_level":"HIGH"}', 'SUCCESS', 6)
ON CONFLICT (id) DO NOTHING;

-- 让后续自增 id 从当前最大值之后继续，避免与种子数据冲突
SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));
SELECT setval(pg_get_serial_sequence('inventories', 'id'), (SELECT MAX(id) FROM inventories));
SELECT setval(pg_get_serial_sequence('orders', 'id'), (SELECT MAX(id) FROM orders));
SELECT setval(pg_get_serial_sequence('operation_plans', 'id'), (SELECT MAX(id) FROM operation_plans));
SELECT setval(pg_get_serial_sequence('agent_runs', 'id'), (SELECT MAX(id) FROM agent_runs));
