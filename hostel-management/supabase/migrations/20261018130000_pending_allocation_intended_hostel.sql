-- Keep intended hostel routing separate from actual room allocation.
-- Review the preflight assumptions before applying to any project.
-- Manual read-only preflight before review/application:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'students'
--     AND column_name IN ('hostel_id', 'room_id', 'intended_hostel_id');
--   SELECT policyname, cmd, roles, qual FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'students'
--     AND cmd IN ('SELECT', 'ALL');
-- Compare the policy names and helper schema with the migration preflight.

BEGIN;

DO $$
DECLARE
  v_students_oid OID := to_regclass('public.students');
  v_hostels_oid OID := to_regclass('public.hostels');
  v_has_authenticated_policy BOOLEAN;
  v_has_scoped_policy BOOLEAN;
  v_existing_qual TEXT;
  v_helper_schema TEXT;
BEGIN
  IF v_students_oid IS NULL OR v_hostels_oid IS NULL THEN
    RAISE EXCEPTION 'Expected public.students and public.hostels tables; pending-allocation migration stopped.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = v_students_oid AND attname = 'hostel_id'
      AND atttypid = 'uuid'::regtype AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = v_hostels_oid AND attname = 'warden_id'
      AND atttypid = 'uuid'::regtype AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = v_students_oid AND attname = 'room_id'
      AND atttypid = 'uuid'::regtype AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Expected UUID students.hostel_id, students.room_id, and hostels.warden_id columns; migration stopped.';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_students_oid) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.students; refusing to create a warden-scoped policy.';
  END IF;

  SELECT
    bool_or(policyname = 'students_select_authenticated'),
    bool_or(policyname = 'students_select_scoped'),
    min(qual)
  INTO v_has_authenticated_policy, v_has_scoped_policy, v_existing_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'students' AND cmd IN ('SELECT', 'ALL');

  IF COALESCE(v_has_authenticated_policy, FALSE) = COALESCE(v_has_scoped_policy, FALSE) THEN
    RAISE EXCEPTION 'Expected exactly one recognized students SELECT policy (students_select_authenticated or students_select_scoped); inspect deployed RLS before proceeding.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students' AND cmd IN ('SELECT', 'ALL')
      AND policyname NOT IN ('students_select_authenticated', 'students_select_scoped')
  ) THEN
    RAISE EXCEPTION 'An unrecognized SELECT policy exists on public.students; migration stopped to avoid leaving broader access in place.';
  END IF;

  IF position('private.is_admin()' IN COALESCE(v_existing_qual, '')) > 0 THEN
    v_helper_schema := 'private';
  ELSIF position('public.is_admin()' IN COALESCE(v_existing_qual, '')) > 0 THEN
    v_helper_schema := 'public';
  ELSIF v_has_authenticated_policy
        AND to_regprocedure('public.is_admin()') IS NOT NULL
        AND to_regprocedure('public.is_warden_for_hostel(uuid)') IS NOT NULL THEN
    v_helper_schema := 'public';
  ELSIF v_has_scoped_policy
        AND to_regprocedure('private.is_admin()') IS NOT NULL
        AND to_regprocedure('private.is_warden_for_hostel(uuid)') IS NOT NULL THEN
    v_helper_schema := 'private';
  ELSE
    RAISE EXCEPTION 'Could not identify the deployed admin and assigned-warden helper functions; migration stopped.';
  END IF;

  IF to_regprocedure(format('%I.is_admin()', v_helper_schema)) IS NULL
     OR to_regprocedure(format('%I.is_warden_for_hostel(uuid)', v_helper_schema)) IS NULL
     OR NOT has_function_privilege('authenticated', to_regprocedure(format('%I.is_admin()', v_helper_schema)), 'EXECUTE')
     OR NOT has_function_privilege('authenticated', to_regprocedure(format('%I.is_warden_for_hostel(uuid)', v_helper_schema)), 'EXECUTE') THEN
    RAISE EXCEPTION 'Required authenticated role helpers are missing or not executable; migration stopped.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid IN (
      to_regprocedure(format('%I.is_admin()', v_helper_schema)),
      to_regprocedure(format('%I.is_warden_for_hostel(uuid)', v_helper_schema))
    ) AND NOT prosecdef
  ) THEN
    RAISE EXCEPTION 'Expected security-definer RLS helpers; migration stopped.';
  END IF;
END;
$$;

-- Add a distinct routing field. The existing hostel_id remains the actual
-- allocated hostel and may be cleared by room-allocation triggers when room_id
-- is NULL. Existing records are not backfilled or otherwise changed.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS intended_hostel_id UUID;

DO $$
DECLARE
  v_students_oid OID := 'public.students'::regclass;
  v_hostels_oid OID := 'public.hostels'::regclass;
  v_attnum SMALLINT;
  v_hostel_id_attnum SMALLINT;
  v_named_constraint OID;
BEGIN
  SELECT attnum INTO v_attnum
  FROM pg_attribute
  WHERE attrelid = v_students_oid
    AND attname = 'intended_hostel_id'
    AND atttypid = 'uuid'::regtype
    AND NOT attisdropped;

  IF v_attnum IS NULL THEN
    RAISE EXCEPTION 'public.students.intended_hostel_id is missing or has an incompatible type.';
  END IF;

  SELECT attnum INTO v_hostel_id_attnum
  FROM pg_attribute
  WHERE attrelid = v_hostels_oid
    AND attname = 'id'
    AND atttypid = 'uuid'::regtype
    AND NOT attisdropped;
  IF v_hostel_id_attnum IS NULL THEN
    RAISE EXCEPTION 'public.hostels.id is missing or has an incompatible type.';
  END IF;

  SELECT oid INTO v_named_constraint
  FROM pg_constraint
  WHERE conrelid = v_students_oid
    AND conname = 'students_intended_hostel_id_fkey';

  IF v_named_constraint IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE oid = v_named_constraint
        AND contype = 'f'
        AND confrelid = v_hostels_oid
        AND conkey = ARRAY[v_attnum]::SMALLINT[]
        AND confkey = ARRAY[v_hostel_id_attnum]::SMALLINT[]
        AND confdeltype = 'n'
    ) THEN
      RAISE EXCEPTION 'students_intended_hostel_id_fkey exists with an unexpected definition.';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = v_students_oid
        AND contype = 'f'
        AND v_attnum = ANY(conkey)
    ) THEN
      RAISE EXCEPTION 'An unrecognized foreign key already uses intended_hostel_id; inspect it before proceeding.';
    END IF;
    ALTER TABLE public.students
      ADD CONSTRAINT students_intended_hostel_id_fkey
      FOREIGN KEY (intended_hostel_id) REFERENCES public.hostels(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_students_intended_hostel_id
  ON public.students(intended_hostel_id);

DO $$
DECLARE
  v_has_scoped_policy BOOLEAN;
  v_existing_qual TEXT;
  v_helper_schema TEXT;
  v_roommate_clause TEXT := '';
  v_policy_expression TEXT;
BEGIN
  SELECT
    bool_or(policyname = 'students_select_scoped'),
    min(qual)
  INTO v_has_scoped_policy, v_existing_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'students' AND cmd IN ('SELECT', 'ALL');

  IF position('private.is_admin()' IN COALESCE(v_existing_qual, '')) > 0
     OR (v_has_scoped_policy
         AND to_regprocedure('private.is_admin()') IS NOT NULL
         AND to_regprocedure('private.is_warden_for_hostel(uuid)') IS NOT NULL) THEN
    v_helper_schema := 'private';
  ELSE
    v_helper_schema := 'public';
  END IF;

  -- Keep the existing roommate visibility only when the base public schema
  -- policy already provided it. The scoped private setup did not provide it.
  IF position('ROOM_ID IS NOT NULL' IN upper(COALESCE(v_existing_qual, ''))) > 0 THEN
    v_roommate_clause := ' OR (room_id IS NOT NULL AND room_id = (SELECT room_id FROM public.students WHERE user_id = auth.uid()))';
  END IF;

  v_policy_expression := format(
    '%1$I.is_admin() OR user_id = auth.uid() OR %1$I.is_warden_for_hostel(hostel_id) OR %1$I.is_warden_for_hostel(intended_hostel_id)%2$s',
    v_helper_schema,
    v_roommate_clause
  );

  EXECUTE 'DROP POLICY IF EXISTS students_select_authenticated ON public.students';
  EXECUTE 'DROP POLICY IF EXISTS students_select_scoped ON public.students';
  EXECUTE format(
    'CREATE POLICY students_select_scoped ON public.students FOR SELECT TO authenticated USING (%s)',
    v_policy_expression
  );
END;
$$;

COMMIT;

-- -----------------------------------------------------------------------------
-- Read-only verification (run separately after applying, if approved)
-- -----------------------------------------------------------------------------
-- Confirm the new nullable routing field and its FK:
--   SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS column_type,
--          a.attnotnull
--   FROM pg_attribute a
--   WHERE a.attrelid = 'public.students'::regclass
--     AND a.attname = 'intended_hostel_id' AND NOT a.attisdropped;
--   SELECT conname, confrelid::regclass, confdeltype
--   FROM pg_constraint
--   WHERE conrelid = 'public.students'::regclass
--     AND conname = 'students_intended_hostel_id_fkey';
--
-- Confirm only the scoped SELECT policy remains for students:
--   SELECT policyname, qual
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'students' AND cmd = 'SELECT';
-- Review that the policy includes admin access, a student's own row, and
-- assigned-warden access through either hostel_id or intended_hostel_id.
--
-- Rollback guidance:
-- - Prefer rolling back the application code while retaining this additive
--   column and scoped policy; this keeps intended-hostel values and avoids
--   restoring the base schema's broad warden SELECT policy.
-- - If removing the column is necessary, first preserve any intended-hostel
--   assignments, then use a separately reviewed rollback that removes the FK,
--   index, and column and recreates an appropriately scoped SELECT policy.
--   Do not restore students_select_authenticated unchanged: in schema.sql it
--   permits any warden to read students across hostels.
