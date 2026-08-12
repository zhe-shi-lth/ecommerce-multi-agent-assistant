ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS ck_purchase_orders_status;
ALTER TABLE purchase_orders ADD CONSTRAINT ck_purchase_orders_status CHECK (
    status IN ('PENDING_APPROVAL','REJECTED','CREATED','ORDERED','INBOUND',
               'PARTIALLY_RECEIVED','STOCKED','CANCELLED','CLOSED_SHORT')
);
