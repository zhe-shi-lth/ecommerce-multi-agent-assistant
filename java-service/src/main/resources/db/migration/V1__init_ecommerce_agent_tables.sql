CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    sale_price NUMERIC(12, 2) NOT NULL CHECK (sale_price >= 0),
    target_audience VARCHAR(255) NOT NULL,
    usage_scenario VARCHAR(255) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_products_status CHECK (status IN ('DRAFT', 'ANALYZED', 'NEEDS_REVIEW'))
);

CREATE TABLE inventories (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    current_stock INTEGER NOT NULL CHECK (current_stock >= 0),
    reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    safe_stock_threshold INTEGER NOT NULL CHECK (safe_stock_threshold >= 0),
    purchase_cycle_days INTEGER NOT NULL CHECK (purchase_cycle_days >= 0),
    sales_last_7_days INTEGER NOT NULL DEFAULT 0 CHECK (sales_last_7_days >= 0),
    inventory_status VARCHAR(40) NOT NULL DEFAULT 'ENOUGH',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_inventories_product_id UNIQUE (product_id),
    CONSTRAINT ck_inventories_available_stock CHECK (current_stock >= reserved_stock),
    CONSTRAINT ck_inventories_status CHECK (inventory_status IN ('ENOUGH', 'LOW', 'RISK'))
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING_ANALYSIS',
    address_complete BOOLEAN NOT NULL DEFAULT false,
    paid BOOLEAN NOT NULL DEFAULT false,
    manual_review_required BOOLEAN NOT NULL DEFAULT false,
    fulfillment_suggestion_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_ANALYSIS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_orders_status CHECK (status IN ('PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW')),
    CONSTRAINT ck_orders_fulfillment_suggestion_status CHECK (fulfillment_suggestion_status IN ('PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW'))
);

CREATE TABLE operation_plans (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(80) NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id),
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_plan_json JSONB NOT NULL,
    image_plan_json JSONB NOT NULL,
    inventory_plan_json JSONB NOT NULL,
    fulfillment_plan_json JSONB NOT NULL,
    final_summary TEXT NOT NULL,
    manual_review_required BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(40) NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_operation_plans_trace_id UNIQUE (trace_id),
    CONSTRAINT ck_operation_plans_status CHECK (status IN ('SUCCESS', 'PARTIAL_FAILED', 'FAILED'))
);

CREATE TABLE agent_runs (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(80) NOT NULL,
    operation_plan_id BIGINT NOT NULL REFERENCES operation_plans(id),
    agent_name VARCHAR(80) NOT NULL,
    input_json JSONB NOT NULL,
    output_json JSONB NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'SUCCESS',
    duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_agent_runs_agent_name CHECK (
        agent_name IN (
            'SUPERVISOR_AGENT',
            'PRODUCT_PLANNING_AGENT',
            'IMAGE_CREATIVE_AGENT',
            'INVENTORY_PURCHASE_AGENT',
            'ORDER_FULFILLMENT_AGENT'
        )
    ),
    CONSTRAINT ck_agent_runs_status CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
    CONSTRAINT ck_agent_runs_time_order CHECK (finished_at >= started_at)
);

CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_operation_plans_product_id ON operation_plans(product_id);
CREATE INDEX idx_operation_plans_order_id ON operation_plans(order_id);
CREATE INDEX idx_agent_runs_trace_id ON agent_runs(trace_id);
CREATE INDEX idx_agent_runs_operation_plan_id ON agent_runs(operation_plan_id);
