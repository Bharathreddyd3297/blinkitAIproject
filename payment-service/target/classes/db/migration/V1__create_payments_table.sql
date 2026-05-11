-- =============================================================================
-- payment-service — initial schema
-- -----------------------------------------------------------------------------
-- Creates the payments table with the indexes required by the platform spec.
-- status uses a length-50 VARCHAR mapped from the PaymentStatus enum
-- (PENDING, SUCCESS, FAILED, REFUNDED).
-- payment_method uses a length-50 VARCHAR mapped from the PaymentMethod enum
-- (UPI, CARD, NETBANKING, WALLET, COD).
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id              BIGSERIAL      PRIMARY KEY,
    order_id        BIGINT         NOT NULL,
    user_id         BIGINT         NOT NULL,
    amount          DECIMAL(10, 2) NOT NULL,
    status          VARCHAR(50)    NOT NULL,
    transaction_id  VARCHAR(255),
    payment_method  VARCHAR(50),
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payments_amount_non_negative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id  ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments (status);
