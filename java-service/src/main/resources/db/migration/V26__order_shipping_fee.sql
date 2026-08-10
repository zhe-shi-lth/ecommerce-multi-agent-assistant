-- 订单发货运费（成本闭环线2）：与采购单进货运费严格区分的三类运费之一。
--   purchase_shipping_fee（采购单表）  供应商 -> 卖家仓库 的运费
--   shipping_fee          （本迁移，订单表） 卖家 -> 买家 的实际发货运费
--   post_fee              （订单表已有）      买家支付的邮费 / 平台订单邮费
-- shipping_fee_type 标记来源：MANUAL(发货时手填) / TEMPLATE(运费模板预估，后续扩展)

ALTER TABLE orders
    ADD COLUMN shipping_fee      NUMERIC(12, 2),
    ADD COLUMN shipping_fee_type VARCHAR(20);
