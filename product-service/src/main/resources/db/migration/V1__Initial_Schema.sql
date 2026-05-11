-- Initial schema for product-service

CREATE TABLE IF NOT EXISTS products (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(150)   NOT NULL,
    category    VARCHAR(80)    NOT NULL,
    price       NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock       INTEGER        NOT NULL CHECK (stock >= 0),
    image_url   VARCHAR(500),
    description VARCHAR(2000),
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version     BIGINT         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_name     ON products (name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_name_lower ON products (LOWER(name));
