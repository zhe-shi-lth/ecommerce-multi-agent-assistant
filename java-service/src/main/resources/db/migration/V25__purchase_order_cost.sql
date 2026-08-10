-- 采购单成本闭环（线2）：补齐采购成本核算字段。
-- 成本口径（与订单发货运费严格区分）：
--   unit_cost            进货单价（供应商 -> 卖家仓库）
--   product_amount       商品金额 = unit_cost * quantity
--   purchase_shipping_fee 进货运费（供应商发到卖家仓库的运费）
--   total_cost           总成本 = product_amount + purchase_shipping_fee
--   landed_unit_cost     单件综合成本 = total_cost / actual_quantity
--   expected_arrival_at  预计到货时间
--   actual_quantity      实际入库数量（默认 = quantity；现实可能到货少于下单，字段先留出来）

ALTER TABLE purchase_orders
    ADD COLUMN unit_cost             NUMERIC(12, 2),
    ADD COLUMN product_amount        NUMERIC(14, 2),
    ADD COLUMN purchase_shipping_fee NUMERIC(12, 2),
    ADD COLUMN total_cost            NUMERIC(14, 2),
    ADD COLUMN landed_unit_cost      NUMERIC(12, 2),
    ADD COLUMN expected_arrival_at   TIMESTAMPTZ,
    ADD COLUMN actual_quantity       INT;

-- 历史采购单把实际入库数量默认对齐采购数量，保证存量数据可参与成本计算。
UPDATE purchase_orders SET actual_quantity = quantity WHERE actual_quantity IS NULL;
