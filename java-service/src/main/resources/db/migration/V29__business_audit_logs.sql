CREATE TABLE business_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    domain VARCHAR(30) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(60) NOT NULL,
    before_status VARCHAR(40),
    after_status VARCHAR(40),
    operator VARCHAR(255) NOT NULL,
    detail VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON business_audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_domain_created ON business_audit_logs(domain, created_at);
