-- =============================================================================
-- order-service — initial schema
-- -----------------------------------------------------------------------------
-- Creates the orders + order_items tables with the indexes required by the
-- platform spec. status uses a length-50 VARCHAR mapped from the OrderStatus
-- enum (CREATED, PAYMENT_PENDING, PAID, FAILED, CANCELLED, DELIVERED).
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id            BIGSERIAL      PRIMARY KEY,
    user_id       BIGINT         NOT NULL,
    total_amount  DECIMAL(10, 2) NOT NULL,
    status        VARCHAR(50)    NOT NULL,
    created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_orders_total_amount_non_negative CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
    id            BIGSERIAL      PRIMARY KEY,
    order_id      BIGINT         NOT NULL,
    product_id    BIGINT         NOT NULL,
    product_name  VARCHAR(255),
    quantity      INTEGER        NOT NULL,
    price         DECIMAL(10, 2),
    total_price   DECIMAL(10, 2),
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);
