CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_companies_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE TABLE stores (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name VARCHAR(120) NOT NULL,
    code VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_stores_company_code UNIQUE (company_id, code),
    CONSTRAINT ck_stores_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE TABLE company_members (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    role VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_company_members_company_user UNIQUE (company_id, user_id),
    CONSTRAINT ck_company_members_role CHECK (role IN ('OWNER', 'OPERATOR', 'PURCHASER', 'WAREHOUSE')),
    CONSTRAINT ck_company_members_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE TABLE store_platform_configs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    store_id BIGINT NOT NULL REFERENCES stores(id),
    platform VARCHAR(20) NOT NULL,
    credentials_ciphertext TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_store_platform_configs UNIQUE (store_id, platform),
    CONSTRAINT ck_store_platform CHECK (platform IN ('taobao', 'douyin', 'xiaohongshu'))
);

INSERT INTO companies(name) VALUES ('默认企业');
INSERT INTO stores(company_id, name, code)
SELECT id, '默认店铺', 'default' FROM companies WHERE name = '默认企业' ORDER BY id LIMIT 1;
INSERT INTO company_members(company_id, user_id, role)
SELECT c.id, u.id, CASE WHEN u.role = 'SUPER_ADMIN' THEN 'OWNER' ELSE 'OPERATOR' END
FROM users u CROSS JOIN (SELECT id FROM companies WHERE name = '默认企业' ORDER BY id LIMIT 1) c;

ALTER TABLE products ADD COLUMN company_id BIGINT;
ALTER TABLE products ADD COLUMN store_id BIGINT;
ALTER TABLE inventories ADD COLUMN company_id BIGINT;
ALTER TABLE inventories ADD COLUMN store_id BIGINT;
ALTER TABLE orders ADD COLUMN company_id BIGINT;
ALTER TABLE orders ADD COLUMN store_id BIGINT;
ALTER TABLE suppliers ADD COLUMN company_id BIGINT;
ALTER TABLE purchase_orders ADD COLUMN company_id BIGINT;
ALTER TABLE purchase_orders ADD COLUMN store_id BIGINT;
ALTER TABLE operation_plans ADD COLUMN company_id BIGINT;
ALTER TABLE operation_plans ADD COLUMN store_id BIGINT;
ALTER TABLE agent_runs ADD COLUMN company_id BIGINT;
ALTER TABLE agent_runs ADD COLUMN store_id BIGINT;
ALTER TABLE daily_sales ADD COLUMN company_id BIGINT;
ALTER TABLE daily_sales ADD COLUMN store_id BIGINT;
ALTER TABLE product_listings ADD COLUMN company_id BIGINT;
ALTER TABLE product_listings ADD COLUMN store_id BIGINT;
ALTER TABLE media_assets ADD COLUMN company_id BIGINT;
ALTER TABLE media_assets ADD COLUMN store_id BIGINT;
ALTER TABLE purchase_receipts ADD COLUMN company_id BIGINT;
ALTER TABLE purchase_receipts ADD COLUMN store_id BIGINT;
ALTER TABLE after_sales_orders ADD COLUMN company_id BIGINT;
ALTER TABLE after_sales_orders ADD COLUMN store_id BIGINT;
ALTER TABLE inventory_movements ADD COLUMN company_id BIGINT;
ALTER TABLE inventory_movements ADD COLUMN store_id BIGINT;
ALTER TABLE business_audit_logs ADD COLUMN company_id BIGINT;
ALTER TABLE business_audit_logs ADD COLUMN store_id BIGINT;
ALTER TABLE business_audit_logs ADD COLUMN user_id BIGINT;
ALTER TABLE platform_tasks ADD COLUMN company_id BIGINT;
ALTER TABLE platform_tasks ADD COLUMN store_id BIGINT;

DO $$
DECLARE c BIGINT; s BIGINT;
BEGIN
  SELECT id INTO c FROM companies WHERE name = '默认企业' ORDER BY id LIMIT 1;
  SELECT id INTO s FROM stores WHERE company_id = c ORDER BY id LIMIT 1;
  UPDATE products SET company_id=c, store_id=s;
  UPDATE inventories SET company_id=c, store_id=s;
  UPDATE orders SET company_id=c, store_id=s;
  UPDATE suppliers SET company_id=c;
  UPDATE purchase_orders SET company_id=c, store_id=s;
  UPDATE operation_plans SET company_id=c, store_id=s;
  UPDATE agent_runs SET company_id=c, store_id=s;
  UPDATE daily_sales SET company_id=c, store_id=s;
  UPDATE product_listings SET company_id=c, store_id=s;
  UPDATE media_assets SET company_id=c, store_id=s;
  UPDATE purchase_receipts SET company_id=c, store_id=s;
  UPDATE after_sales_orders SET company_id=c, store_id=s;
  UPDATE inventory_movements SET company_id=c, store_id=s;
  UPDATE business_audit_logs SET company_id=c, store_id=s;
  UPDATE business_audit_logs l SET user_id=u.id FROM users u WHERE lower(l.operator)=lower(u.email);
  UPDATE platform_tasks SET company_id=c, store_id=s;
END $$;

ALTER TABLE products ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE inventories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE inventories ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE operation_plans ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE operation_plans ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE agent_runs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE agent_runs ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE daily_sales ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE daily_sales ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE product_listings ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE product_listings ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE media_assets ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE media_assets ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE purchase_receipts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE purchase_receipts ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE after_sales_orders ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE after_sales_orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE inventory_movements ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE inventory_movements ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE business_audit_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE business_audit_logs ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE platform_tasks ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE platform_tasks ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_name_key;
ALTER TABLE suppliers ADD CONSTRAINT uk_suppliers_company_name UNIQUE(company_id, name);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS uk_orders_platform_order;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_platform_platform_order_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uk_orders_store_platform_order ON orders(store_id, platform, platform_order_id);

CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_inventories_store ON inventories(store_id);
CREATE INDEX idx_orders_store ON orders(store_id, created_at);
CREATE INDEX idx_suppliers_company ON suppliers(company_id);
CREATE INDEX idx_purchase_orders_store ON purchase_orders(store_id, created_at);
CREATE INDEX idx_operation_plans_store ON operation_plans(store_id, created_at);
CREATE INDEX idx_audit_store_created ON business_audit_logs(store_id, created_at);
CREATE INDEX idx_platform_tasks_store ON platform_tasks(store_id, created_at);

ALTER TABLE daily_sales DROP CONSTRAINT IF EXISTS uk_daily_sales_product_platform_date;
ALTER TABLE daily_sales ADD CONSTRAINT uk_daily_sales_store_product_platform_date UNIQUE(store_id, product_id, platform, sale_date);
