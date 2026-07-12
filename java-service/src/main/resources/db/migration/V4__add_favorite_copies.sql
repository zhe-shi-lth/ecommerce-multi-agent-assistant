-- 收藏优秀文案：供用户手动沉淀可复用的文案片段（结果回流的手动版）。
CREATE TABLE favorite_copies (
    id BIGSERIAL PRIMARY KEY,
    label VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    tags VARCHAR(200),
    source_plan_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
