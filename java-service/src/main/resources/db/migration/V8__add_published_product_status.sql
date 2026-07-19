-- 商品新增「已发布(PUBLISHED)」状态：线1 上架确认后即视为已发布，
-- 仅已发布的商品才能被「平台模拟」拉单。
ALTER TABLE products DROP CONSTRAINT ck_products_status;
ALTER TABLE products ADD CONSTRAINT ck_products_status
    CHECK (status IN ('DRAFT', 'ANALYZED', 'NEEDS_REVIEW', 'PUBLISHED'));
