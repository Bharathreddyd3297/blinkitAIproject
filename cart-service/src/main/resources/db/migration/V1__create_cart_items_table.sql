CREATE TABLE IF NOT EXISTS cart_items (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT         NOT NULL,
    product_id    BIGINT         NOT NULL,
    product_name  VARCHAR(255),
    quantity      INTEGER        NOT NULL,
    price         DECIMAL(10, 2),
    total_price   DECIMAL(10, 2),
    created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cart_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_cart_user_id    ON cart_items (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_product_id ON cart_items (product_id);
