-- 采购单入库备注（成本闭环线2）：确认入库时记录实际到货与破损/少发说明。
ALTER TABLE purchase_orders ADD COLUMN inbound_note VARCHAR(500);
