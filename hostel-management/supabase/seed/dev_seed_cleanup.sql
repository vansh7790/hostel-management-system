-- DEV-ONLY: remove the dummy data created by dev_seed.sql (and anything a tester
-- created inside the [TEST] hostels). Refuses to run outside a marked dev project.
-- Records outside the test hostels / test IDs / test domain are not touched.
--
-- After this, delete the test logins with:
--   node --env-file=supabase/seed/seed.env.local supabase/seed/create-test-accounts.mjs --delete
-- Run this SQL first: deleting a login cascades to its linked student record.

BEGIN;

DO $guard$
BEGIN
  -- Separate checks: PL/pgSQL plans a whole IF expression, so the marker table
  -- may only be referenced after its existence is confirmed.
  IF pg_catalog.to_regclass('private.dev_environment') IS NULL THEN
    RAISE EXCEPTION 'Not a marked development project (private.dev_environment missing). Cleanup aborted; nothing was deleted.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dev_environment) THEN
    RAISE EXCEPTION 'Not a marked development project (private.dev_environment is empty). Cleanup aborted; nothing was deleted.';
  END IF;
END;
$guard$;

CREATE TEMP TABLE seed_test_hostels ON COMMIT DROP AS
  SELECT id FROM public.hostels WHERE name LIKE '[TEST] %';

DELETE FROM public.notices
WHERE hostel_id IN (SELECT id FROM seed_test_hostels)
   OR posted_by IN (SELECT id FROM public.profiles WHERE email LIKE '%@hostel-test.example');

-- Complaints and leave requests cascade with their student.
DELETE FROM public.students
WHERE student_id LIKE 'TST26-%'
   OR email LIKE '%@hostel-test.example'
   OR hostel_id IN (SELECT id FROM seed_test_hostels)
   OR intended_hostel_id IN (SELECT id FROM seed_test_hostels);

-- Rooms cascade with their hostel.
DELETE FROM public.hostels WHERE id IN (SELECT id FROM seed_test_hostels);

COMMIT;

SELECT
  (SELECT count(*) FROM public.hostels WHERE name LIKE '[TEST] %') AS remaining_test_hostels,
  (SELECT count(*) FROM public.students WHERE student_id LIKE 'TST26-%') AS remaining_test_students;
