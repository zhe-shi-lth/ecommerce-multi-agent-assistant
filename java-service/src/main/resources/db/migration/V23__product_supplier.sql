-- 商品关联主供应商（每个商品一个主供应商，可空）
ALTER TABLE products ADD COLUMN supplier_id BIGINT;
ALTER TABLE products
    ADD CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
