CREATE SCHEMA IF NOT EXISTS caisse;

CREATE TABLE IF NOT EXISTS caisse.users (
  email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisse.suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  niu TEXT,
  regime TEXT NOT NULL DEFAULT 'simplified',
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisse.invoices (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  supplier_id TEXT REFERENCES caisse.suppliers(id) ON DELETE SET NULL,
  line_code TEXT NOT NULL,
  quarter_code TEXT NOT NULL,
  invoice_date DATE,
  regime TEXT NOT NULL DEFAULT 'simplified',
  amount_ht BIGINT NOT NULL DEFAULT 0,
  amount_tva BIGINT NOT NULL DEFAULT 0,
  amount_air BIGINT NOT NULL DEFAULT 0,
  amount_ttc BIGINT NOT NULL DEFAULT 0,
  amount_nap BIGINT NOT NULL DEFAULT 0,
  expense_label TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  reject_reason TEXT,
  paid_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisse.invoice_checklist_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES caisse.invoices(id) ON DELETE CASCADE,
  checklist_code TEXT NOT NULL,
  label_fr TEXT NOT NULL,
  label_en TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_id, checklist_code)
);

CREATE TABLE IF NOT EXISTS caisse.replenishments (
  id TEXT PRIMARY KEY,
  quarter_code TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  received_date DATE,
  ref TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisse.disbursements (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES caisse.invoices(id) ON DELETE SET NULL,
  invoice_ref TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  payment_date DATE,
  payment_mode TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisse.journal_entries (
  id TEXT PRIMARY KEY,
  entry_date DATE,
  ref TEXT,
  label TEXT,
  account_code TEXT,
  debit BIGINT NOT NULL DEFAULT 0,
  credit BIGINT NOT NULL DEFAULT 0,
  balance BIGINT NOT NULL DEFAULT 0,
  entry_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisse.audit_checklists (
  id BIGSERIAL PRIMARY KEY,
  quarter_code TEXT NOT NULL,
  checklist_code TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quarter_code, checklist_code)
);

CREATE TABLE IF NOT EXISTS caisse.app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON caisse.invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quarter_code ON caisse.invoices(quarter_code);
CREATE INDEX IF NOT EXISTS idx_disbursements_invoice_id ON caisse.disbursements(invoice_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON caisse.journal_entries(entry_date);

INSERT INTO caisse.app_state (key, value)
VALUES
  ('pak_rdla_invoices', '[]'::jsonb),
  ('pak_rdla_suppliers', '[]'::jsonb),
  ('pak_rdla_disbursements', '[]'::jsonb),
  ('pak_rdla_replenishments', '[]'::jsonb),
  ('pak_rdla_journal', '[]'::jsonb),
  ('pak_rdla_verifications', '[]'::jsonb),
  ('pak_audit_checklist_Q1', '{}'::jsonb),
  ('pak_audit_checklist_Q2', '{}'::jsonb),
  ('pak_audit_checklist_Q3', '{}'::jsonb),
  ('pak_audit_checklist_Q4', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO caisse.users (email, first_name, last_name, role, password_hash)
VALUES
  ('habib.iya@pak.cm', 'Habib', 'Iya', 'Ordonnateur', '7bca8a21635f6e829bfd32d97a6b3d69:759b892018d34f37ca6af47aba7eb2805550d084e770b9cdddd934ec598138f0cd70daa26dbc2faa49b56c5087ef4759fe1ab5119efb6a502eb2b9589a8c62ab'),
  ('polivone.kange@pak.cm', 'Polivone', 'Kange', 'Regisseur', '3e16fb58954bfca0c6671cfa03d2c25f:3b101acf49157de818ab70a7afadaae62c48e53cb9147785b09242e9d18e98f4a42990410b65c6de09601a471dcea0f9951d722fa096fa1e91e5725428793249'),
  ('sandrine.banini@pak.cm', 'Sandrine', 'Banini', 'Controleur', '18c4c6e4673bb2b3545ddae5593b58a6:9a1f3da6dc069fa548777dc3eb7143b0e01d493f0e972f71136ef7baad9aaea19ea15beb8d8e3a18cee0ec15512a47e721550d17c5ed5b55dddbd10052f5c3f5')
ON CONFLICT (email) DO NOTHING;
