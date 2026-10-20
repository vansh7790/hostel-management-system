-- Secure, database-only linking between Supabase Auth accounts and student records.
--
-- Supersedes 20261019140000_link_verified_student_accounts.sql and is safe to run
-- whether or not that file was applied: every object is created with CREATE OR
-- REPLACE / IF NOT EXISTS, the file has no statement that removes objects or rows, and
-- no table, column, or row is removed. Data changes made by the backfill at the end:
--   * students.user_id is set on UNLINKED records that pass the verified-identity
--     check (already-linked records are never changed);
--   * profiles.email of those confirmed student accounts is synced to the
--     verified auth.users email when it differs.
-- Linking failures never block sign-up or email confirmation: the trigger entry
-- points catch errors, emit a WARNING, and leave the record unlinked.
--
-- Security model
-- * students.user_id is never written by the browser. It is set only when:
--     - the Auth account's email is CONFIRMED (auth.users.email_confirmed_at),
--     - exactly one student record has that normalized email and is unlinked,
--     - the signup student_id metadata matches the record (or, for older accounts
--       without that metadata, the profile name matches the record name), and
--     - the account is a 'student' profile not already linked elsewhere.
-- * Linking runs when the account is created/confirmed AND when an admin/warden
--   creates a student record or changes its email (record created after signup).
-- * Non-admin users cannot change their profile email to anything other than
--   their verified Auth email.
-- * A student may update only phone/guardian/address on their own record.
--
-- REQUIREMENT: Supabase Dashboard > Authentication > Providers > Email >
-- "Confirm email" MUST be enabled. With it disabled, email_confirmed_at is set
-- at signup without proving inbox ownership and the email check is meaningless.
--
-- Run as the postgres role in the SQL Editor (no end-user JWT).

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Run this migration as postgres without an end-user JWT; migration stopped.';
  END IF;

  IF pg_catalog.to_regclass('public.students') IS NULL
     OR pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Expected public.students, public.profiles, and auth.users; migration stopped.';
  END IF;

  IF pg_catalog.to_regprocedure('private.is_admin()') IS NULL
     OR pg_catalog.to_regprocedure('private.is_warden_for_hostel(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected private.is_admin() and private.is_warden_for_hostel(uuid); migration stopped.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.students'::regclass AND attname = 'intended_hostel_id' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'students.intended_hostel_id is missing; apply 20261018130000 first.';
  END IF;

  -- The signup profile trigger may call public.handle_new_user() or
  -- private.handle_new_user(); only its presence matters here.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'auth.users'::regclass AND t.tgname = 'on_auth_user_created'
      AND t.tgenabled IN ('O', 'A') AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Enabled on_auth_user_created trigger is missing; migration stopped.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.students'::regclass
      AND t.tgname = 'trg_prevent_student_identity_reassignment' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Expected trg_prevent_student_identity_reassignment on public.students; migration stopped.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students AS s
    GROUP BY pg_catalog.lower(pg_catalog.btrim(s.email))
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized student emails exist. Resolve them before enabling account linking.';
  END IF;
END;
$preflight$;

-- One student record per normalized email, so a verified email identifies at most one record.
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_normalized_email
  ON public.students (pg_catalog.lower(pg_catalog.btrim(email)));

-- ---------------------------------------------------------------------------
-- Verified identity check (pure predicate)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_verified_student_identity_link(p_student_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_auth_email text;
  v_confirmed_at timestamptz;
  v_metadata jsonb;
  v_profile_name text;
  v_profile_role text;
BEGIN
  IF p_student_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.email, u.email_confirmed_at, u.raw_user_meta_data
    INTO v_auth_email, v_confirmed_at, v_metadata
  FROM auth.users AS u
  WHERE u.id = p_user_id;

  IF NOT FOUND OR v_auth_email IS NULL OR v_confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.full_name, p.role INTO v_profile_name, v_profile_role
  FROM public.profiles AS p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR v_profile_role <> 'student' THEN
    RETURN false;
  END IF;

  -- The account must not already own a different student record.
  IF EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = p_user_id AND s.id <> p_student_id) THEN
    RETURN false;
  END IF;

  IF (SELECT pg_catalog.count(*) FROM public.students AS s
      WHERE pg_catalog.lower(pg_catalog.btrim(s.email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email))) <> 1 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.students AS s
    WHERE s.id = p_student_id
      AND pg_catalog.lower(pg_catalog.btrim(s.email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email))
      AND CASE
        WHEN NULLIF(pg_catalog.btrim(v_metadata ->> 'student_id'), '') IS NOT NULL THEN
          pg_catalog.upper(pg_catalog.btrim(s.student_id)) = pg_catalog.upper(pg_catalog.btrim(v_metadata ->> 'student_id'))
        ELSE
          pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(s.name), '\s+', ' ', 'g'))
            = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(COALESCE(v_profile_name, '')), '\s+', ' ', 'g'))
      END
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Link an Auth account to its single verified student record (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.link_verified_student_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email text;
  v_confirmed_at timestamptz;
  v_student_id uuid;
BEGIN
  SELECT u.email, u.email_confirmed_at INTO v_email, v_confirmed_at
  FROM auth.users AS u WHERE u.id = p_user_id;

  IF NOT FOUND OR v_email IS NULL OR v_confirmed_at IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_user_id AND p.role = 'student') THEN
    RETURN;
  END IF;

  -- Keep the profile email equal to the verified Auth email.
  UPDATE public.profiles AS p
  SET email = v_email, updated_at = pg_catalog.now()
  WHERE p.id = p_user_id AND p.email IS DISTINCT FROM v_email;

  IF EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = p_user_id) THEN
    RETURN;
  END IF;

  SELECT s.id INTO v_student_id
  FROM public.students AS s
  WHERE pg_catalog.lower(pg_catalog.btrim(s.email)) = pg_catalog.lower(pg_catalog.btrim(v_email))
    AND s.user_id IS NULL
  FOR UPDATE;

  IF v_student_id IS NULL OR NOT private.is_verified_student_identity_link(v_student_id, p_user_id) THEN
    RETURN;
  END IF;

  UPDATE public.students AS s
  SET user_id = p_user_id, updated_at = pg_catalog.now()
  WHERE s.id = v_student_id AND s.user_id IS NULL;
END;
$function$;

-- Auth-side trigger: account created or email confirmed/changed.
CREATE OR REPLACE FUNCTION private.handle_verified_student_auth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  BEGIN
    PERFORM private.link_verified_student_profile(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Fail safe: leave the record unlinked rather than blocking authentication.
    RAISE WARNING 'Student account link skipped for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- Student-side trigger: record created (or its email changed) after the student
-- already has a confirmed account.
CREATE OR REPLACE FUNCTION private.handle_student_record_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_match_count integer;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT pg_catalog.count(*), pg_catalog.min(u.id::text)::uuid INTO v_match_count, v_user_id
  FROM auth.users AS u
  WHERE u.email_confirmed_at IS NOT NULL
    AND pg_catalog.lower(pg_catalog.btrim(u.email)) = pg_catalog.lower(pg_catalog.btrim(NEW.email));

  IF v_match_count = 1 THEN
    BEGIN
      PERFORM private.link_verified_student_profile(v_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Student record link skipped for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Identity guard: user_id/student_id are admin-only, except the single verified link.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.prevent_student_identity_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.student_id IS NOT DISTINCT FROM OLD.student_id THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR private.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Any caller may only ever set user_id to the one account whose confirmed
  -- email and student ID identify this record; no other column may change
  -- through this path.
  IF OLD.user_id IS NULL
     AND NEW.user_id IS NOT NULL
     AND NEW.student_id IS NOT DISTINCT FROM OLD.student_id
     AND private.is_verified_student_identity_link(OLD.id, NEW.user_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: Student identity fields cannot be reassigned.' USING ERRCODE = '42501';
END;
$function$;

-- ---------------------------------------------------------------------------
-- Profile guard: non-admins cannot set their profile email to an unverified value.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.protect_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.email IS NOT DISTINCT FROM OLD.email OR auth.uid() IS NULL OR private.is_admin() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = NEW.id AND u.email IS NOT DISTINCT FROM NEW.email) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: Profile email must match the verified sign-in email.' USING ERRCODE = '42501';
END;
$function$;

-- ---------------------------------------------------------------------------
-- Student self-update guard: a student may edit only contact details.
-- Admins, assigned wardens (actual or intended hostel), and trusted database
-- execution are unaffected; their existing rules still apply.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.restrict_student_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR private.is_admin()
     OR private.is_warden_for_hostel(OLD.hostel_id)
     OR private.is_warden_for_hostel(OLD.intended_hostel_id) THEN
    RETURN NEW;
  END IF;

  IF (pg_catalog.to_jsonb(NEW) - ARRAY['phone', 'guardian_name', 'guardian_phone', 'address', 'updated_at']::text[])
     IS DISTINCT FROM
     (pg_catalog.to_jsonb(OLD) - ARRAY['phone', 'guardian_name', 'guardian_phone', 'address', 'updated_at']::text[]) THEN
    RAISE EXCEPTION 'Permission denied: Students may update only phone, guardian, and address details.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Room allocation validator: identical to the deployed baseline, plus a room
-- under maintenance cannot receive NEW occupants (existing occupants stay).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.check_student_room_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room_capacity INTEGER;
  v_room_hostel_id UUID;
  v_room_status TEXT;
  v_current_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.room_id IS DISTINCT FROM NEW.room_id THEN
    PERFORM id FROM public.rooms
    WHERE id = OLD.room_id OR id = NEW.room_id
    ORDER BY id FOR UPDATE;
  ELSIF NEW.room_id IS NOT NULL THEN
    PERFORM id FROM public.rooms WHERE id = NEW.room_id FOR UPDATE;
  END IF;

  IF NEW.room_id IS NULL THEN
    NEW.hostel_id := NULL;
    RETURN NEW;
  END IF;

  SELECT capacity, hostel_id, status INTO v_room_capacity, v_room_hostel_id, v_room_status
  FROM public.rooms WHERE id = NEW.room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target room does not exist.';
  END IF;

  NEW.hostel_id := v_room_hostel_id;

  IF v_room_status = 'maintenance'
     AND (TG_OP = 'INSERT' OR OLD.room_id IS DISTINCT FROM NEW.room_id) THEN
    RAISE EXCEPTION 'Room allocation failed: Room is under maintenance.';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.students
  WHERE room_id = NEW.room_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_current_count + 1 > v_room_capacity THEN
    RAISE EXCEPTION 'Room allocation failed: Room capacity (%) would be exceeded.', v_room_capacity;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.check_student_room_allocation() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION private.is_verified_student_identity_link(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION private.link_verified_student_profile(uuid) OWNER TO postgres;
ALTER FUNCTION private.handle_verified_student_auth_link() OWNER TO postgres;
ALTER FUNCTION private.handle_student_record_link() OWNER TO postgres;
ALTER FUNCTION private.prevent_student_identity_reassignment() OWNER TO postgres;
ALTER FUNCTION private.protect_profile_email() OWNER TO postgres;
ALTER FUNCTION private.restrict_student_self_update() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_verified_student_identity_link(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.link_verified_student_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.handle_verified_student_auth_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.handle_student_record_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_student_identity_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.protect_profile_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.restrict_student_self_update() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers (CREATE OR REPLACE keeps this idempotent and non-destructive;
-- names sort after on_auth_user_created)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER zz_link_verified_student_after_auth_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_verified_student_auth_link();

CREATE OR REPLACE TRIGGER zz_link_verified_student_after_auth_confirmation
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_verified_student_auth_link();

CREATE OR REPLACE TRIGGER trg_link_student_record_after_insert
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.handle_student_record_link();

CREATE OR REPLACE TRIGGER trg_link_student_record_after_email_update
  AFTER UPDATE OF email ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.handle_student_record_link();

CREATE OR REPLACE TRIGGER trg_protect_profile_email
  BEFORE UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.protect_profile_email();

CREATE OR REPLACE TRIGGER trg_restrict_student_self_update
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.restrict_student_self_update();

-- Link already-confirmed accounts using the same verified check.
DO $backfill$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT u.id FROM auth.users AS u WHERE u.email_confirmed_at IS NOT NULL ORDER BY u.id
  LOOP
    PERFORM private.link_verified_student_profile(v_user_id);
  END LOOP;
END;
$backfill$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Read-only verification (run separately after applying)
-- ---------------------------------------------------------------------------
-- SELECT tgrelid::regclass, tgname, tgfoid::regprocedure FROM pg_trigger
-- WHERE NOT tgisinternal AND tgname IN (
--   'zz_link_verified_student_after_auth_insert','zz_link_verified_student_after_auth_confirmation',
--   'trg_link_student_record_after_insert','trg_link_student_record_after_email_update',
--   'trg_protect_profile_email','trg_restrict_student_self_update','trg_prevent_student_identity_reassignment');
-- SELECT count(*) AS students, count(*) FILTER (WHERE user_id IS NULL) AS unlinked FROM public.students;
