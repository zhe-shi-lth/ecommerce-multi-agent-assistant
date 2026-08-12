ALTER TABLE orders ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE operation_plans ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE purchase_orders ADD COLUMN received_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD CONSTRAINT ck_purchase_received_nonnegative CHECK (received_quantity >= 0);
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS ck_purchase_orders_status;
ALTER TABLE purchase_orders ADD CONSTRAINT ck_purchase_orders_status CHECK (
    status IN ('PENDING_APPROVAL','REJECTED','CREATED','ORDERED','INBOUND','PARTIALLY_RECEIVED','STOCKED','CANCELLED')
);

CREATE TABLE product_listings (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    operation_plan_id BIGINT REFERENCES operation_plans(id),
    platform VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    external_item_id VARCHAR(160),
    external_url TEXT,
    last_message VARCHAR(1000),
    published_at TIMESTAMPTZ,
    unpublished_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_product_listing_product_platform UNIQUE (product_id, platform),
    CONSTRAINT ck_product_listing_platform CHECK (platform IN ('taobao','douyin','xiaohongshu')),
    CONSTRAINT ck_product_listing_status CHECK (status IN ('PENDING','PUBLISHED','UNPUBLISHED','FAILED'))
);
CREATE INDEX idx_product_listings_plan ON product_listings(operation_plan_id);

INSERT INTO product_listings(product_id, operation_plan_id, platform, status, published_at, created_at, updated_at)
SELECT DISTINCT ON (product_id, platform)
       product_id, id, platform, 'PUBLISHED', COALESCE(confirmed_at, updated_at), created_at, updated_at
FROM operation_plans
WHERE confirmation_status = 'CONFIRMED'
  AND line = 'LINE1_ONBOARDING'
  AND platform IN ('taobao','douyin','xiaohongshu')
ORDER BY product_id, platform, updated_at DESC;

CREATE TABLE media_assets (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id),
    operation_plan_id BIGINT REFERENCES operation_plans(id),
    asset_type VARCHAR(20) NOT NULL,
    source_url TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    content_type VARCHAR(100),
    byte_size BIGINT,
    sha256 VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_media_asset_type CHECK (asset_type IN ('IMAGE','VIDEO'))
);
CREATE INDEX idx_media_assets_plan ON media_assets(operation_plan_id);

CREATE TABLE purchase_receipts (
    id BIGSERIAL PRIMARY KEY,
    purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id),
    receipt_no VARCHAR(80) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    note VARCHAR(500),
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operator VARCHAR(255) NOT NULL
);
CREATE INDEX idx_purchase_receipts_order ON purchase_receipts(purchase_order_id, received_at);

CREATE TABLE after_sales_orders (
    id BIGSERIAL PRIMARY KEY,
    after_sale_no VARCHAR(80) NOT NULL UNIQUE,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refund_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    reason VARCHAR(500) NOT NULL,
    return_disposition VARCHAR(30),
    refunded_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_after_sale_type CHECK (type IN ('REFUND_ONLY','RETURN_REFUND')),
    CONSTRAINT ck_after_sale_status CHECK (status IN ('PENDING','REFUNDED','WAITING_RETURN','COMPLETED','REJECTED')),
    CONSTRAINT ck_after_sale_disposition CHECK (return_disposition IS NULL OR return_disposition IN ('RESTOCK','DAMAGED'))
);
CREATE INDEX idx_after_sales_order ON after_sales_orders(order_id, created_at);
