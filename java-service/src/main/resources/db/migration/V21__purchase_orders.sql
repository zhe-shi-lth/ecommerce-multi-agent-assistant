-- 采购补货（线2 库存处理工作台）主表：补货建议 → 采购单 → 已下单 → 待入库 → 已入库 → 库存增加。
-- 生命周期状态：CREATED(待采购) / ORDERED(已下单) / INBOUND(待入库) / STOCKED(已入库)。

CREATE TABLE purchase_orders (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products (id),
    quantity    INT    NOT NULL,
    supplier    VARCHAR(120),
    status      VARCHAR(40) NOT NULL,
    note        VARCHAR(500),
    ordered_at  TIMESTAMPTZ,
    inbound_at  TIMESTAMPTZ,
    stocked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_orders_status ON purchase_orders (status);
CREATE INDEX idx_purchase_orders_product ON purchase_orders (product_id);
