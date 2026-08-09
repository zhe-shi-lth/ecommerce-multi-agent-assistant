-- 订单扩展：对齐各大平台真实订单 API 返回的结构化字段
-- 淘宝 taobao.trade.fullinfo.get / 抖店 order.detail / 小红书 order.getOrderDetail
-- 收件人地址、买家标识、实付金额+邮费、物流运单；encrypted 标记抖音/小红书对收件人加密(密文/隐私号)
ALTER TABLE orders
    ADD COLUMN receiver_name VARCHAR(60),
    ADD COLUMN receiver_phone VARCHAR(40),
    ADD COLUMN receiver_province VARCHAR(40),
    ADD COLUMN receiver_city VARCHAR(40),
    ADD COLUMN receiver_district VARCHAR(40),
    ADD COLUMN receiver_detail TEXT,
    ADD COLUMN buyer_nick VARCHAR(80),
    ADD COLUMN payment NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN post_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN logistics_company VARCHAR(60),
    ADD COLUMN waybill_no VARCHAR(60),
    ADD COLUMN encrypted BOOLEAN NOT NULL DEFAULT false;
