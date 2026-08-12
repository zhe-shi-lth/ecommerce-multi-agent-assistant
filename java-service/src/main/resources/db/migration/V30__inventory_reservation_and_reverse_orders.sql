ALTER TABLE orders
    ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN reverse_reason VARCHAR(500),
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN refunded_at TIMESTAMPTZ,
    ADD COLUMN returned_at TIMESTAMPTZ;

ALTER TABLE orders
    ADD CONSTRAINT ck_orders_reserved_quantity
        CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity);

ALTER TABLE orders DROP CONSTRAINT ck_orders_status;
ALTER TABLE orders ADD CONSTRAINT ck_orders_status
    CHECK (status IN (
        'PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW',
        'SHIPPED', 'REJECTED', 'SHIPPING_FAILED', 'CANCELLED', 'REFUNDED', 'RETURNED'
    ));

ALTER TABLE orders DROP CONSTRAINT ck_orders_fulfillment_suggestion_status;
ALTER TABLE orders ADD CONSTRAINT ck_orders_fulfillment_suggestion_status
    CHECK (fulfillment_suggestion_status IN (
        'PENDING_ANALYSIS', 'READY_TO_SHIP', 'INSUFFICIENT_STOCK', 'NEEDS_REVIEW',
        'SHIPPED', 'REJECTED', 'SHIPPING_FAILED', 'CANCELLED', 'REFUNDED', 'RETURNED'
    ));

CREATE TABLE inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    movement_type VARCHAR(40) NOT NULL,
    current_delta INTEGER NOT NULL DEFAULT 0,
    reserved_delta INTEGER NOT NULL DEFAULT 0,
    current_after INTEGER NOT NULL,
    reserved_after INTEGER NOT NULL,
    reference_type VARCHAR(40),
    reference_id BIGINT,
    reason VARCHAR(500) NOT NULL,
    operator VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_inventory_movement_nonempty CHECK (current_delta <> 0 OR reserved_delta <> 0)
);

CREATE INDEX idx_inventory_movements_product_created
    ON inventory_movements(product_id, created_at DESC);
CREATE INDEX idx_inventory_movements_reference
    ON inventory_movements(reference_type, reference_id, created_at DESC);
