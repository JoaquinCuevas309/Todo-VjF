-- ============================================================
-- Ejecutar como superusuario de PostgreSQL (postgres)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS casino;
SET search_path TO casino;

CREATE TYPE user_role AS ENUM ('admin', 'operator', 'diner');
CREATE TYPE tx_status AS ENUM ('completed', 'reversed', 'pending');
CREATE TYPE payment_method AS ENUM ('balance', 'payroll_discount', 'cash', 'free');
CREATE TYPE reservation_status AS ENUM ('active', 'consumed', 'cancelled', 'expired');

-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rut             VARCHAR(12) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    full_name       VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'diner',
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES users(id),

    CONSTRAINT rut_format CHECK (rut ~ '^\d{7,8}-[\dkK]$'),
    CONSTRAINT email_format CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

CREATE UNIQUE INDEX idx_users_rut ON users(UPPER(rut));
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- ============================================================
CREATE TABLE menus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_date    DATE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    max_portions    SMALLINT NOT NULL,
    served_portions SMALLINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT max_portions_positive CHECK (max_portions > 0),
    CONSTRAINT served_lte_max CHECK (served_portions <= max_portions)
);

CREATE INDEX idx_menus_date ON menus(service_date);
CREATE UNIQUE INDEX idx_menus_date_name ON menus(service_date, name) WHERE is_active = TRUE;

-- ============================================================
CREATE TABLE menu_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id     UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(100),
    calories    SMALLINT CHECK (calories > 0),
    allergens   TEXT[]
);

-- ============================================================
CREATE TABLE reservations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    menu_id     UUID NOT NULL REFERENCES menus(id),
    status      reservation_status NOT NULL DEFAULT 'active',
    qr_token    VARCHAR(64) UNIQUE,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ NOT NULL,

    CONSTRAINT consumed_requires_timestamp
        CHECK (status != 'consumed' OR consumed_at IS NOT NULL)
);

CREATE UNIQUE INDEX idx_reservations_user_menu
    ON reservations(user_id, menu_id)
    WHERE status IN ('active', 'consumed');

CREATE INDEX idx_reservations_qr ON reservations(qr_token);

-- ============================================================
CREATE TABLE balances (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id),
    amount      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT non_negative_balance CHECK (amount >= 0)
);

-- ============================================================
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    menu_id         UUID REFERENCES menus(id),
    operator_id     UUID NOT NULL REFERENCES users(id),
    reservation_id  UUID REFERENCES reservations(id),
    status          tx_status NOT NULL DEFAULT 'completed',
    payment_method  payment_method NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_user ON transactions(user_id);
CREATE INDEX idx_tx_date ON transactions(created_at);
CREATE INDEX idx_tx_operator ON transactions(operator_id);

REVOKE UPDATE, DELETE ON transactions FROM PUBLIC;

-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(128) NOT NULL UNIQUE,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at  TIMESTAMPTZ,
    ip_address  INET,
    user_agent  VARCHAR(512)
);

CREATE INDEX idx_rt_user ON refresh_tokens(user_id) WHERE revoked = FALSE;

-- ============================================================
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity      VARCHAR(100),
    entity_id   UUID,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  INET,
    user_agent  VARCHAR(512),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_date ON audit_logs(created_at);

REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_menus_updated_at
    BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Permisos mínimos para el usuario de la app
-- ============================================================
-- Ejecutar esto como superusuario:
-- GRANT CONNECT ON DATABASE casino_db TO casino_app;
-- GRANT USAGE ON SCHEMA casino TO casino_app;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA casino TO casino_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA casino TO casino_app;
-- REVOKE DELETE ON casino.transactions FROM casino_app;
-- REVOKE DELETE ON casino.audit_logs FROM casino_app;
