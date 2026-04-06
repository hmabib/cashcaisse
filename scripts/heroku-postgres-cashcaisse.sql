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
  ('mohammed.iya.habib@pak.local', 'Mohammed', 'Iya Habib', 'Ordonnateur', '41da2231b7ce5b32da3b243fb6b2f7ef:3f7141beeeb3c42caca9e9bc35b6df667740997d8fc6de4a27679525ec784f27d13484f3986bc3273a7addf603efd7878b4bed3d772836d30841d0a2960a8841'),
  ('kange.polivone@pak.local', 'Kange', 'Polivone', 'Regisseur', '450df2bf3a955d80fc916521484ee630:0a056939ad3be518aeb9eb0d05f86ee7ba2aeba536d8f5ea999d75ede2b51d7b9aa4573920c12b4b603175a7fbdc2bef90ea9aa9fe7c221fd6f1d5d8664a33d5'),
  ('banini.sandrine@pak.local', 'Banini', 'Sandrine', 'Controleur', 'b3a9df3a5c4b247a6bc80fd54f31fb7e:645f82b29f68900dd9f978bf8ef2b95a1411ea03ea622995b969476e9aea07eaaf6af1038bd883aaab154252c628c237af8d001d679f513e708f3c055805db29')
ON CONFLICT (email) DO NOTHING;
