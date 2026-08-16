ALTER TABLE categories ADD COLUMN company_id BIGINT;

UPDATE categories
SET company_id = (SELECT id FROM companies WHERE name = '默认企业' ORDER BY id LIMIT 1)
WHERE company_id IS NULL;

ALTER TABLE categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE categories ADD CONSTRAINT fk_categories_company FOREIGN KEY (company_id) REFERENCES companies(id);
CREATE INDEX idx_categories_company_id ON categories(company_id);
