-- =============================================================================
-- FINANZAPP — Esquema Relacional PostgreSQL 16
-- Módulo de Integración Continua para Proyectos de Software
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  occupation VARCHAR(120) NOT NULL DEFAULT 'Gestión Personal',
  currency VARCHAR(8) NOT NULL DEFAULT 'COP' CHECK (currency IN ('COP', 'USD', 'MXN', 'EUR')),
  monthly_savings_rate_goal INTEGER NOT NULL DEFAULT 20 CHECK (monthly_savings_rate_goal BETWEEN 0 AND 90),
  avatar_key VARCHAR(32) NOT NULL DEFAULT 'initials',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  email VARCHAR(160) PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('banco', 'ahorros', 'efectivo', 'inversion', 'billetera_digital')),
  institution VARCHAR(120) NOT NULL,
  account_number VARCHAR(40) NOT NULL,
  balance NUMERIC(16, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(16) NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  color VARCHAR(16) NOT NULL DEFAULT '#14243A'
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id VARCHAR(40) NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id VARCHAR(40) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type VARCHAR(16) NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  description VARCHAR(255) NOT NULL,
  tx_date DATE NOT NULL,
  reference VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id VARCHAR(40) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  budget_month CHAR(7) NOT NULL,
  limit_amount NUMERIC(16, 2) NOT NULL CHECK (limit_amount > 0),
  alert_threshold INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold BETWEEN 50 AND 100),
  UNIQUE (user_id, category_id, budget_month)
);

CREATE TABLE IF NOT EXISTS debts (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creditor VARCHAR(120) NOT NULL,
  title VARCHAR(160) NOT NULL,
  total_amount NUMERIC(16, 2) NOT NULL CHECK (total_amount > 0),
  remaining_amount NUMERIC(16, 2) NOT NULL CHECK (remaining_amount >= 0),
  monthly_installment NUMERIC(16, 2) NOT NULL DEFAULT 0,
  interest_rate_annual NUMERIC(5, 2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  total_installments INTEGER NOT NULL DEFAULT 12,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id VARCHAR(40) PRIMARY KEY,
  debt_id VARCHAR(40) NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  account_id VARCHAR(40) NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  note VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  target_amount NUMERIC(16, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline DATE NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id VARCHAR(40) PRIMARY KEY,
  goal_id VARCHAR(40) NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  account_id VARCHAR(40) REFERENCES accounts(id) ON DELETE SET NULL,
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  contribution_date DATE NOT NULL,
  note VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, tx_date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, budget_month);
CREATE INDEX IF NOT EXISTS idx_debts_user_due ON debts(user_id, due_date);
