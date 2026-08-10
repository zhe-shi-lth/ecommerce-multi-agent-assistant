-- 进货商家档案（主数据）
CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL UNIQUE,
    contact_name    VARCHAR(60),
    contact_phone   VARCHAR(40),
    address         VARCHAR(255),
    settlement_type VARCHAR(20),
    lead_time_days  INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    remark          VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
