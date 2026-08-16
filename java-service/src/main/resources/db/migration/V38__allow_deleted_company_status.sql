-- 企业删除走「软删除」：deleteCompany 将状态置为 DELETED（companies() 列表按此过滤隐藏）。
-- 原 ck_companies_status 仅允许 ACTIVE/DISABLED，会使软删除失败，这里放开为包含 DELETED。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_companies_status') THEN
    ALTER TABLE companies DROP CONSTRAINT ck_companies_status;
  END IF;
END $$;

ALTER TABLE companies ADD CONSTRAINT ck_companies_status CHECK (status IN ('ACTIVE', 'DISABLED', 'DELETED'));
