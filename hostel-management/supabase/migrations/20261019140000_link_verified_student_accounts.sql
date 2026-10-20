-- Link a confirmed Auth account to exactly one pre-created student record.
-- New registrations must provide the matching student ID as well as control
-- the record's email address. Existing accounts without that metadata are
-- linked only when the verified email and profile name identify one record.

BEGIN;

DO $preflight$
DECLARE
  v_students_oid oid := pg_catalog.to_regclass('public.students');
  v_profiles_oid oid := pg_catalog.to_regclass('public.profiles');
  v_auth_users_oid oid := pg_catalog.to_regclass('auth.users');
  v_user_id_attnum smallint;
  v_profile_id_attnum smallint;
  v_auth_id_attnum smallint;
  v_guard_owner name;
  v_guard_definition text;
  v_auth_profile_trigger_found boolean;
BEGIN
  IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Run this migration as the postgres database role without an end-user JWT; migration stopped.';
  END IF;

  IF v_students_oid IS NULL OR v_profiles_oid IS NULL OR v_auth_users_oid IS NULL THEN
    RAISE EXCEPTION 'Expected public.students, public.profiles, and auth.users; migration stopped.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_students_oid AND attname = 'user_id' AND atttypid = 'uuid'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_students_oid AND attname = 'email' AND atttypid = 'text'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_students_oid AND attname = 'student_id' AND atttypid = 'text'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_students_oid AND attname = 'name' AND atttypid = 'text'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_profiles_oid AND attname = 'id' AND atttypid = 'uuid'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_profiles_oid AND attname = 'email' AND atttypid = 'text'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_profiles_oid AND attname = 'full_name' AND atttypid = 'text'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_profiles_oid AND attname = 'role' AND atttypid = 'text'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_students_oid AND attname = 'user_id' AND NOT attnotnull AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_auth_users_oid AND attname = 'id' AND atttypid = 'uuid'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_auth_users_oid AND attname = 'email_confirmed_at' AND atttypid = 'timestamp with time zone'::regtype AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = v_auth_users_oid AND attname = 'raw_user_meta_data' AND atttypid = 'jsonb'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Expected student/profile identity fields and Supabase Auth confirmation fields; migration stopped.';
  END IF;

  SELECT attnum INTO v_user_id_attnum FROM pg_catalog.pg_attribute
  WHERE attrelid = v_students_oid AND attname = 'user_id' AND NOT attisdropped;
  SELECT attnum INTO v_profile_id_attnum FROM pg_catalog.pg_attribute
  WHERE attrelid = v_profiles_oid AND attname = 'id' AND NOT attisdropped;
  SELECT attnum INTO v_auth_id_attnum FROM pg_catalog.pg_attribute
  WHERE attrelid = v_auth_users_oid AND attname = 'id' AND NOT attisdropped;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_students_oid AND c.contype = 'u'
      AND c.conkey = ARRAY[v_user_id_attnum]::smallint[]
  ) THEN
    RAISE EXCEPTION 'students.user_id must have a single-column unique constraint; migration stopped.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_students_oid AND c.confrelid = v_profiles_oid
      AND c.contype = 'f' AND c.conkey = ARRAY[v_user_id_attnum]::smallint[]
  ) THEN
    RAISE EXCEPTION 'students.user_id must reference profiles.id; migration stopped.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_profiles_oid AND c.confrelid = v_auth_users_oid
      AND c.contype = 'f' AND c.conkey = ARRAY[v_profile_id_attnum]::smallint[]
      AND c.confkey = ARRAY[v_auth_id_attnum]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_profiles_oid AND c.contype = 'p'
      AND c.conkey = ARRAY[v_profile_id_attnum]::smallint[]
  ) THEN
    RAISE EXCEPTION 'profiles.id must be the unique Auth user key and reference auth.users.id; migration stopped.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = v_auth_users_oid
      AND t.tgname = 'on_auth_user_created'
      AND t.tgfoid = 'public.handle_new_user()'::regprocedure
      AND t.tgenabled IN ('O', 'A') AND NOT t.tgisinternal
  ) INTO v_auth_profile_trigger_found;
  IF NOT v_auth_profile_trigger_found THEN
    RAISE EXCEPTION 'Expected enabled on_auth_user_created profile trigger is missing; migration stopped.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students AS s
    GROUP BY pg_catalog.lower(pg_catalog.btrim(s.email))
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized student emails exist. Resolve them before enabling automatic account linking.';
  END IF;

  SELECT r.rolname, pg_catalog.pg_get_functiondef(p.oid)
  INTO v_guard_owner, v_guard_definition
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'private' AND p.proname = 'prevent_student_identity_reassignment' AND p.pronargs = 0
    AND p.prorettype = 'trigger'::regtype;

  IF v_guard_definition IS NULL OR v_guard_owner <> 'postgres'
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger t
       WHERE t.tgrelid = v_students_oid AND t.tgname = 'trg_prevent_student_identity_reassignment'
         AND t.tgfoid = 'private.prevent_student_identity_reassignment()'::regprocedure
         AND t.tgenabled = 'O' AND NOT t.tgisinternal
     )
     OR pg_catalog.strpos(v_guard_definition, 'auth.uid()') = 0
     OR pg_catalog.strpos(v_guard_definition, 'private.is_admin()') = 0
     OR pg_catalog.strpos(pg_catalog.lower(v_guard_definition), 'new.user_id') = 0
     OR pg_catalog.strpos(pg_catalog.lower(v_guard_definition), 'new.student_id') = 0 THEN
    RAISE EXCEPTION 'The expected postgres-owned student identity guard/trigger is missing or differs; migration stopped.';
  END IF;
END;
$preflight$;

-- Guarantee that future registrations cannot race with creation of a second
-- student row for the same normalized email.
CREATE UNIQUE INDEX uq_students_normalized_email
  ON public.students (pg_catalog.lower(pg_catalog.btrim(email)));

CREATE FUNCTION private.is_verified_student_identity_link(p_student_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_auth_email text;
  v_confirmed_at timestamptz;
  v_metadata jsonb;
  v_profile_email text;
  v_profile_name text;
  v_profile_role text;
  v_student_count integer;
BEGIN
  SELECT u.email, u.email_confirmed_at, u.raw_user_meta_data
    INTO v_auth_email, v_confirmed_at, v_metadata
  FROM auth.users AS u
  WHERE u.id = p_user_id;

  IF NOT FOUND OR v_auth_email IS NULL OR v_confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.email, p.full_name, p.role
    INTO v_profile_email, v_profile_name, v_profile_role
  FROM public.profiles AS p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR v_profile_role <> 'student'
     OR pg_catalog.lower(pg_catalog.btrim(v_profile_email)) <> pg_catalog.lower(pg_catalog.btrim(v_auth_email)) THEN
    RETURN false;
  END IF;

  SELECT pg_catalog.count(*) INTO v_student_count
  FROM public.students AS s
  WHERE pg_catalog.lower(pg_catalog.btrim(s.email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email));

  IF v_student_count <> 1 OR EXISTS (
    SELECT 1 FROM public.students AS s
    WHERE s.user_id = p_user_id AND s.id <> p_student_id
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.students AS s
    WHERE s.id = p_student_id
      AND s.user_id IS NULL
      AND pg_catalog.lower(pg_catalog.btrim(s.email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email))
      AND CASE
        WHEN NULLIF(pg_catalog.btrim(v_metadata ->> 'student_id'), '') IS NOT NULL THEN
          pg_catalog.upper(pg_catalog.btrim(s.student_id)) = pg_catalog.upper(pg_catalog.btrim(v_metadata ->> 'student_id'))
        ELSE
          pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(s.name), '\s+', ' ', 'g'))
            = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_profile_name), '\s+', ' ', 'g'))
      END
  );
END;
$function$;

CREATE FUNCTION private.link_verified_student_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email text;
  v_confirmed_at timestamptz;
  v_profile_role text;
  v_candidate record;
  v_match_count integer := 0;
  v_student_id uuid;
  v_existing_user_id uuid;
BEGIN
  SELECT u.email, u.email_confirmed_at
    INTO v_email, v_confirmed_at
  FROM auth.users AS u
  WHERE u.id = p_user_id;

  IF NOT FOUND OR v_email IS NULL OR v_confirmed_at IS NULL THEN
    RETURN;
  END IF;

  SELECT p.role INTO v_profile_role FROM public.profiles AS p WHERE p.id = p_user_id;
  IF v_profile_role IS DISTINCT FROM 'student' THEN
    RETURN;
  END IF;

  UPDATE public.profiles AS p
  SET email = v_email, updated_at = pg_catalog.now()
  WHERE p.id = p_user_id AND p.role = 'student' AND p.email IS DISTINCT FROM v_email;

  -- Lock all records sharing this normalized email. Ambiguous emails fail closed.
  FOR v_candidate IN
    SELECT s.id, s.user_id
    FROM public.students AS s
    WHERE pg_catalog.lower(pg_catalog.btrim(s.email)) = pg_catalog.lower(pg_catalog.btrim(v_email))
    ORDER BY s.id
    FOR UPDATE
  LOOP
    v_match_count := v_match_count + 1;
    v_student_id := v_candidate.id;
    v_existing_user_id := v_candidate.user_id;
  END LOOP;

  IF v_match_count <> 1 OR v_existing_user_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = p_user_id) THEN
    RETURN;
  END IF;

  IF NOT private.is_verified_student_identity_link(v_student_id, p_user_id) THEN
    RETURN;
  END IF;

  UPDATE public.students AS s
  SET user_id = p_user_id
  WHERE s.id = v_student_id AND s.user_id IS NULL;
END;
$function$;

CREATE FUNCTION private.handle_verified_student_auth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM private.link_verified_student_profile(NEW.id);
  RETURN NEW;
END;
$function$;

ALTER FUNCTION private.is_verified_student_identity_link(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION private.link_verified_student_profile(uuid) OWNER TO postgres;
ALTER FUNCTION private.handle_verified_student_auth_link() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_verified_student_identity_link(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.link_verified_student_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.handle_verified_student_auth_link() FROM PUBLIC, anon, authenticated;

-- Preserve the existing admin and trusted database behavior. A non-admin
-- authenticated caller may only make this one transition when the new user is
-- themselves, the verified email and student ID/name checks pass, and no other
-- student fields were changed. Auth-trigger execution with no end-user JWT
-- retains the prior trusted database behavior; the trigger function itself is
-- postgres-owned, non-callable by API roles, and independently validates all
-- identity conditions before issuing this update.
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

  IF OLD.user_id IS NULL
     AND NEW.user_id = auth.uid()
     AND NEW.student_id IS NOT DISTINCT FROM OLD.student_id
     AND (pg_catalog.to_jsonb(NEW) - 'user_id' - 'updated_at')
         IS NOT DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'user_id' - 'updated_at')
     AND private.is_verified_student_identity_link(OLD.id, NEW.user_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: Student identity fields cannot be reassigned.';
END;
$function$;

-- These triggers run only as a consequence of Supabase Auth writes. The helper
-- itself checks email confirmation, role, exact normalized email, uniqueness,
-- and the intended identity before updating students.user_id.
CREATE TRIGGER zz_link_verified_student_after_auth_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_verified_student_auth_link();

CREATE TRIGGER zz_link_verified_student_after_auth_confirmation
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_verified_student_auth_link();

-- Link already-confirmed accounts conservatively using the same validation.
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
