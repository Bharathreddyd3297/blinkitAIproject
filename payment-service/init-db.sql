-- =============================================================================
-- payment-service — PostgreSQL bootstrap
-- -----------------------------------------------------------------------------
-- Mounted into the postgres container at
--   /docker-entrypoint-initdb.d/init-db.sql
-- and executed exactly once when the data volume is first created. Subsequent
-- container starts skip this file because the data directory is already
-- initialised. To re-run it, remove the postgres named volume.
-- =============================================================================

-- The container is launched with POSTGRES_DB=blinkit_payments, so the database
-- is auto-created by the official postgres image entrypoint before this script
-- runs. We use a guarded DO block here so the script is also safe to run
-- standalone against a fresh postgres that does NOT have POSTGRES_DB set.
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'blinkit_payments') THEN
        CREATE DATABASE blinkit_payments;
    END IF;
END
$$;
