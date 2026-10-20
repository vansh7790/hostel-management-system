-- Run ONCE, and ONLY in the development Supabase project.
-- dev_seed.sql, dev_seed_cleanup.sql and create-test-accounts.mjs refuse to run
-- unless this marker exists, so dummy data can never be loaded into (or
-- cleaned from) production by mistake. Never run this file in production.

BEGIN;

CREATE TABLE IF NOT EXISTS private.dev_environment (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  marked_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT 'Development project: dummy seed data allowed'
);
-- RLS on with no policies: anon/authenticated are denied even if a grant is
-- added later. The owner (postgres) and the SECURITY DEFINER marker function
-- below bypass RLS as owner, so the seed tooling still reads the marker.
ALTER TABLE private.dev_environment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.dev_environment FROM PUBLIC, anon, authenticated;
INSERT INTO private.dev_environment (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Lets the account-seeding script (service role only) confirm it is talking to
-- a marked dev project. Browser roles (anon/authenticated) cannot execute it.
CREATE OR REPLACE FUNCTION public.dev_environment_marker()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM private.dev_environment);
$$;
REVOKE ALL ON FUNCTION public.dev_environment_marker() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dev_environment_marker() TO service_role;

COMMIT;

SELECT 'dev environment marker present' AS status, marked_at FROM private.dev_environment;
