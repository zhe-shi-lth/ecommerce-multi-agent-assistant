-- 采购单关联进货商家：新增 supplier_id 外键；原 supplier 文本列复用为「商家名称快照」。
ALTER TABLE purchase_orders ADD COLUMN supplier_id BIGINT;
ALTER TABLE purchase_orders
    ADD CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
