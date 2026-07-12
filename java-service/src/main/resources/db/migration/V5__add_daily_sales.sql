-- 销售时序数据：供监控页渲染日营业额/销量曲线，并作为库存 Agent 的日销依据。
CREATE TABLE daily_sales (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    sale_date DATE NOT NULL,
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    units INTEGER NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE daily_sales ADD CONSTRAINT uk_daily_sales_product_date UNIQUE (product_id, sale_date);

-- 幂等种子：为商品 1/2/3 生成最近 14 天示例日销（已存在则跳过）。
INSERT INTO daily_sales (product_id, sale_date, revenue, units, order_count)
SELECT
    p.id,
    (CURRENT_DATE - (g.d || ' days')::INTERVAL)::DATE,
    (2 + (g.d % 4) + p.id) * p.sale_price,
    (2 + (g.d % 4) + p.id),
    (1 + (g.d % 3))
FROM generate_series(0, 13) AS g(d)
CROSS JOIN products p
WHERE p.id IN (1, 2, 3)
ON CONFLICT (product_id, sale_date) DO NOTHING;
