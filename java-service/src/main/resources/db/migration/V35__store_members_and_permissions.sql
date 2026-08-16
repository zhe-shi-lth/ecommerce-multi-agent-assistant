CREATE TABLE store_members (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    store_id BIGINT NOT NULL REFERENCES stores(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_store_members_store_user UNIQUE(store_id,user_id),
    CONSTRAINT ck_store_members_status CHECK(status IN ('ACTIVE','DISABLED'))
);
CREATE TABLE store_member_permissions (
    id BIGSERIAL PRIMARY KEY,
    store_member_id BIGINT NOT NULL REFERENCES store_members(id) ON DELETE CASCADE,
    permission VARCHAR(40) NOT NULL,
    CONSTRAINT uk_store_member_permission UNIQUE(store_member_id,permission)
);

-- 历史员工从企业成员迁移到默认店铺；超级管理员不再属于任何企业。
INSERT INTO store_members(company_id,store_id,user_id,status)
SELECT cm.company_id,s.id,cm.user_id,cm.status
FROM company_members cm JOIN stores s ON s.company_id=cm.company_id
WHERE cm.status='ACTIVE' AND EXISTS(SELECT 1 FROM users u WHERE u.id=cm.user_id AND u.role<>'SUPER_ADMIN')
ON CONFLICT (store_id,user_id) DO NOTHING;
INSERT INTO store_member_permissions(store_member_id,permission)
SELECT sm.id,p.permission
FROM store_members sm CROSS JOIN (VALUES
 ('PRODUCT_VIEW'),('PRODUCT_EDIT'),('CONTENT_GENERATE'),('CONTENT_REVIEW'),('CONTENT_PUBLISH'),
 ('ORDER_VIEW'),('ORDER_REVIEW'),('ORDER_SHIP'),('INVENTORY_VIEW'),('INVENTORY_ADJUST'),
 ('PURCHASE_CREATE'),('PURCHASE_APPROVE'),('PURCHASE_RECEIVE'),('SUPPLIER_MANAGE'),
 ('PLATFORM_CONFIG'),('MEMBER_MANAGE'),('STORE_MANAGE'),('AUDIT_VIEW')) p(permission)
ON CONFLICT DO NOTHING;
DELETE FROM company_members WHERE user_id IN (SELECT id FROM users WHERE role='SUPER_ADMIN');
UPDATE company_members SET role='OWNER' WHERE user_id=(SELECT id FROM users WHERE role<>'SUPER_ADMIN' ORDER BY id LIMIT 1);
CREATE INDEX idx_store_members_user ON store_members(user_id,status);
CREATE INDEX idx_store_members_store ON store_members(store_id,status);
