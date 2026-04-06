const { Pool } = require('pg');
const { hashPassword } = require('./auth');

const DEFAULT_STATE = {
  pak_rdla_invoices: [],
  pak_rdla_suppliers: [],
  pak_rdla_disbursements: [],
  pak_rdla_replenishments: [],
  pak_rdla_journal: [],
  pak_rdla_verifications: [],
  pak_audit_checklist_Q1: {},
  pak_audit_checklist_Q2: {},
  pak_audit_checklist_Q3: {},
  pak_audit_checklist_Q4: {}
};

const DEFAULT_USERS = [
  {
    email: 'mohammed.iya.habib@pak.local',
    first_name: 'Mohammed',
    last_name: 'Iya Habib',
    role: 'Ordonnateur',
    password: 'mohammed'
  },
  {
    email: 'kange.polivone@pak.local',
    first_name: 'Kange',
    last_name: 'Polivone',
    role: 'Regisseur',
    password: 'kange'
  },
  {
    email: 'banini.sandrine@pak.local',
    first_name: 'Banini',
    last_name: 'Sandrine',
    role: 'Controleur',
    password: 'banini'
  }
];

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('sslmode=disable')
    ? false
    : { rejectUnauthorized: false }
});

let bootstrapPromise;

async function ensureDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap();
  }
  return bootstrapPromise;
}

async function bootstrap() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA IF NOT EXISTS caisse');
    await client.query(`
      CREATE TABLE IF NOT EXISTS caisse.users (
        email TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS caisse.app_state (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const [key, value] of Object.entries(DEFAULT_STATE)) {
      await client.query(
        `
          INSERT INTO caisse.app_state (key, value)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (key) DO NOTHING
        `,
        [key, JSON.stringify(value)]
      );
    }

    for (const user of DEFAULT_USERS) {
      await client.query(
        `
          INSERT INTO caisse.users (email, first_name, last_name, role, password_hash)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (email) DO NOTHING
        `,
        [
          user.email,
          user.first_name,
          user.last_name,
          user.role,
          hashPassword(user.password)
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    bootstrapPromise = null;
    throw error;
  } finally {
    client.release();
  }
}

async function getUserByEmail(email) {
  await ensureDatabase();
  const { rows } = await pool.query(
    `
      SELECT email, first_name, last_name, role, password_hash, is_active
      FROM caisse.users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email]
  );
  return rows[0] || null;
}

async function getAllState() {
  await ensureDatabase();
  const { rows } = await pool.query('SELECT key, value FROM caisse.app_state');
  const state = { ...DEFAULT_STATE };
  for (const row of rows) {
    state[row.key] = row.value;
  }
  return state;
}

async function setStateValue(key, value) {
  await ensureDatabase();
  await pool.query(
    `
      INSERT INTO caisse.app_state (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [key, JSON.stringify(value)]
  );
}

module.exports = {
  pool,
  DEFAULT_USERS,
  ensureDatabase,
  getUserByEmail,
  getAllState,
  setStateValue
};
