-- 订单成本/毛利快照（成本闭环线2）：发货成功时写入，避免后续商品成本价变动导致历史订单利润漂移。
--   cost_price_snapshot   发货时商品成本价快照
--   goods_cost_snapshot   商品成本合计 = cost_price_snapshot * quantity
--   gross_profit          预估毛利 = payment - goods_cost_snapshot - shipping_fee
-- 已发货订单用快照展示，未发货订单仍按当前成本实时计算。

ALTER TABLE orders
    ADD COLUMN cost_price_snapshot  NUMERIC(12, 2),
    ADD COLUMN goods_cost_snapshot  NUMERIC(14, 2),
    ADD COLUMN gross_profit         NUMERIC(14, 2);
