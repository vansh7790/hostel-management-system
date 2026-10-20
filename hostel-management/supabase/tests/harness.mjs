// Test harness: executes the deployed baseline + migrations in real Postgres (PGlite) and runs
// an RLS / attack matrix as simulated Supabase `authenticated` users.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// SQL files live one directory above this test folder (hostel-management/supabase).
const SQL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(SQL_DIR, p), 'utf8');

const SUPABASE_STUBS = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
`;

export async function freshDb(migrations) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(read('initial_setup_review3.sql'));
  const results = [];
  for (const m of migrations) {
    const sql = typeof m === 'string' ? read(m) : m.sql;
    const name = typeof m === 'string' ? m : m.name;
    try {
      await db.exec(sql);
      results.push({ name, ok: true });
    } catch (e) {
      await db.exec('ROLLBACK').catch(() => {});
      results.push({ name, ok: false, error: e.message });
    }
  }
  return { db, results };
}

// Run statements as an authenticated user inside a transaction that is always rolled back
// unless keep=true. Returns { rows, error }.
export async function as(db, userId, sql, params = [], keep = true) {
  try {
    await db.exec('BEGIN');
    await db.exec('SET LOCAL ROLE authenticated');
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
    const res = await db.query(sql, params);
    await db.exec(keep ? 'COMMIT' : 'ROLLBACK');
    return { rows: res.rows, affected: res.affectedRows ?? res.rows.length, error: null };
  } catch (e) {
    await db.exec('ROLLBACK').catch(() => {});
    return { rows: [], affected: 0, error: e.message };
  }
}

export async function sys(db, sql, params = []) {
  return (await db.query(sql, params)).rows;
}

export async function createAuthUser(db, email, { confirmed = true, studentId = null, name = null } = {}) {
  const meta = {};
  if (studentId) meta.student_id = studentId;
  if (name) meta.full_name = name;
  const rows = await sys(db,
    `INSERT INTO auth.users (email, email_confirmed_at, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id`,
    [email, confirmed ? new Date().toISOString() : null, JSON.stringify(meta)]);
  return rows[0].id;
}
