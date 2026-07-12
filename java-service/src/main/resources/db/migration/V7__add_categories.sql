-- 品类（基础数据）：商品创建时选择所属品类，供上架/筛选复用。
-- MVP 仅支持增 + 列表，不做删除（避免误删已用品类）。
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
