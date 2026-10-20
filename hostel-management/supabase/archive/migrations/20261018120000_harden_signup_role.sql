-- Force all profiles created by public signup to start as students.
-- This migration does not change RLS policies, existing profiles, or Auth users.
-- Review the preflight assumptions below before applying to any project.

BEGIN;

DO $$
DECLARE
  v_handler_definition TEXT;
  v_auth_trigger_found BOOLEAN;
  v_role_trigger_found BOOLEAN;
  v_role_trigger_definition TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Expected Supabase auth.users and public.profiles tables; migration stopped.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION 'public.profiles is missing an expected column (role, full_name, or email); migration stopped.';
  END IF;

  IF to_regprocedure('public.handle_new_user()') IS NULL THEN
    RAISE EXCEPTION 'public.handle_new_user() is missing; inspect the deployed signup trigger before proceeding.';
  END IF;

  v_handler_definition := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  IF position('raw_user_meta_data' IN v_handler_definition) = 0
     OR position('full_name' IN v_handler_definition) = 0
     OR position('ON CONFLICT' IN upper(v_handler_definition)) = 0 THEN
    RAISE EXCEPTION 'Signup handler differs from the reviewed implementation; inspect it manually before migration.';
  END IF;

  SELECT count(*) = 1,
         min(pg_get_triggerdef(t.oid))
    INTO v_role_trigger_found, v_role_trigger_definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND t.tgname = 'trg_prevent_role_escalation'
      AND NOT t.tgisinternal;

  IF NOT v_role_trigger_found
     OR to_regprocedure('public.prevent_profile_role_escalation()') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'profiles'
         AND t.tgname = 'trg_prevent_role_escalation'
         AND NOT t.tgisinternal
         AND t.tgfoid = 'public.prevent_profile_role_escalation()'::regprocedure
         AND t.tgenabled = 'O'
         AND lower(regexp_replace(pg_get_triggerdef(t.oid), '\s+', ' ', 'g')) =
             'create trigger trg_prevent_role_escalation before update of role on public.profiles for each row execute function public.prevent_profile_role_escalation()'
     ) THEN
    RAISE EXCEPTION 'Expected ordinary-mode trg_prevent_role_escalation on public.profiles invoking public.prevent_profile_role_escalation() with the reviewed definition; migration stopped.';
  END IF;

  /*
   * A deployment with a duplicate trigger name is not an expected layout either.
   * The count and exact trigger-definition checks above intentionally fail closed.
   */
  IF v_role_trigger_definition IS NULL THEN
    RAISE EXCEPTION 'Could not inspect trg_prevent_role_escalation; migration stopped.';
  END IF;

  /*
   * Preserve the exact deployed guard. This migration changes only the signup
   * handler; it does not replace or disable the role-change function/trigger.
   */
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth'
      AND c.relname = 'users'
      AND t.tgname = 'on_auth_user_created'
      AND t.tgfoid = 'public.handle_new_user()'::regprocedure
      AND NOT t.tgisinternal
      AND t.tgenabled IN ('O', 'A')
  ) INTO v_auth_trigger_found;

  IF NOT v_auth_trigger_found THEN
    RAISE EXCEPTION 'Expected enabled auth.users trigger on_auth_user_created was not found; migration stopped.';
  END IF;

END;
$$;

-- Keep the reviewed profile fields and conflict behavior. In the conflict case,
-- refresh name/email but preserve the existing role, so an existing privileged
-- profile is never demoted as a side effect of this trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'student'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;

-- -----------------------------------------------------------------------------
-- Manual preflight and verification (run separately in Supabase SQL Editor)
-- -----------------------------------------------------------------------------
-- Confirm the SQL Editor execution context before any bootstrap operation:
--   SELECT current_user, session_user, auth.uid();
-- Supabase documents SQL Editor queries as running through the postgres role;
-- without an end-user JWT, auth.uid() is NULL. Stop if this is not the context.
--
-- Confirm the role guard has the exact reviewed function binding, definition,
-- and ordinary enabled mode expected by this migration (zero rows means stop):
--   SELECT t.tgname, t.tgenabled, t.tgfoid::regprocedure,
--          pg_get_triggerdef(t.oid) AS trigger_definition
--   FROM pg_trigger t
--   JOIN pg_class c ON c.oid = t.tgrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relname = 'profiles'
--     AND t.tgname = 'trg_prevent_role_escalation' AND NOT t.tgisinternal;
-- Expected function: public.prevent_profile_role_escalation(); mode: O.
--
-- Confirm the signup trigger remains enabled and points to the hardened handler:
--   SELECT t.tgname, t.tgenabled, t.tgfoid::regprocedure
--   FROM pg_trigger t
--   JOIN pg_class c ON c.oid = t.tgrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'auth' AND c.relname = 'users'
--     AND t.tgname = 'on_auth_user_created' AND NOT t.tgisinternal;
--
-- Verify the hardened handler's role assignment and conflict behavior from its
-- installed definition. The body must insert the literal student role and must
-- not update role in the ON CONFLICT clause:
--   SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
-- Confirm the deployed body matches the function in this migration before
-- treating the signup-role hardening as verified.
--
-- Inspect existing roles and recent profiles (do not expose personal details in
-- client logs):
--   SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY role;
--   SELECT id, email, role FROM public.profiles WHERE role IN ('admin', 'warden');
--
-- After creating a dedicated test Auth account through a trusted test procedure,
-- attempt signup with metadata role='admin' and role='warden'; both resulting
-- public.profiles.role values must be 'student'. Do not perform this test by
-- creating accounts in production without authorization.

-- -----------------------------------------------------------------------------
-- One-time first-admin bootstrap procedure (manual; NOT run by this migration)
-- -----------------------------------------------------------------------------
-- 1. Create the intended Auth account normally and complete identity/email
--    verification. Confirm its UUID and exact email in Supabase Auth.
-- 2. In SQL Editor, replace both placeholders below with that verified UUID and
--    email. Review the target identity and existing-admin count first.
-- 3. Execute only as SQL Editor's postgres role. This procedure verifies no
--    admin exists, verifies the exact Auth user and matching student profile,
--    locks public.profiles, temporarily disables only the role-change trigger
--    inside this transaction, promotes exactly that row, and re-enables it before
--    commit. This is necessary because the reviewed trigger rejects role changes
--    when auth.uid() is NULL. Use only this trusted SQL Editor procedure; never
--    expose it as a client-callable RPC. The table lock blocks conflicting writes
--    to profiles until commit, so run it during a quiet period and keep the
--    transaction short. Transaction rollback undoes both trigger changes and the
--    promotion if any step fails.
-- 4. Re-running is a no-op only when this exact target is already the sole admin;
--    every other existing-admin or role combination fails closed.
--
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- DO $bootstrap$
-- DECLARE
--   v_target_text TEXT := 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
--   v_target_id UUID;
--   v_expected_email TEXT := 'REPLACE_WITH_VERIFIED_EMAIL';
--   v_auth_count INTEGER;
--   v_admin_count INTEGER;
--   v_profile_email TEXT;
--   v_profile_role TEXT;
--   v_updated INTEGER;
--   v_trigger_mode "char";
-- BEGIN
--   IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
--     RAISE EXCEPTION 'Run this bootstrap only in Supabase SQL Editor as postgres with no end-user JWT.';
--   END IF;
--   IF v_expected_email IS NULL OR position('REPLACE_' IN v_expected_email) > 0 THEN
--     RAISE EXCEPTION 'Replace the bootstrap placeholders with a verified Auth UUID and email.';
--   END IF;
--   IF v_target_text IS NULL OR position('REPLACE_' IN v_target_text) > 0 THEN
--     RAISE EXCEPTION 'Replace the bootstrap placeholders with a verified Auth UUID and email.';
--   END IF;
--   v_target_id := v_target_text::UUID;
--
--   LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
--
--   SELECT count(*) INTO v_auth_count FROM auth.users
--   WHERE id = v_target_id AND lower(email) = lower(v_expected_email);
--   IF v_auth_count <> 1 THEN
--     RAISE EXCEPTION 'The specified Auth user UUID/email pair was not found exactly once.';
--   END IF;
--
--   SELECT email, role INTO v_profile_email, v_profile_role
--   FROM public.profiles WHERE id = v_target_id;
--   IF NOT FOUND OR lower(v_profile_email) <> lower(v_expected_email) THEN
--     RAISE EXCEPTION 'The matching public.profiles row is missing or its email does not match.';
--   END IF;
--
--
--   SELECT t.tgenabled INTO v_trigger_mode
--   FROM pg_trigger t
--   JOIN pg_class c ON c.oid = t.tgrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relname = 'profiles'
--     AND t.tgname = 'trg_prevent_role_escalation' AND NOT t.tgisinternal;
--   IF v_trigger_mode IS DISTINCT FROM 'O' OR NOT EXISTS (
--     SELECT 1 FROM pg_trigger t
--     JOIN pg_class c ON c.oid = t.tgrelid
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND c.relname = 'profiles'
--       AND t.tgname = 'trg_prevent_role_escalation' AND NOT t.tgisinternal
--       AND t.tgfoid = 'public.prevent_profile_role_escalation()'::regprocedure
--       AND lower(regexp_replace(pg_get_triggerdef(t.oid), '\s+', ' ', 'g')) =
--           'create trigger trg_prevent_role_escalation before update of role on public.profiles for each row execute function public.prevent_profile_role_escalation()'
--   ) THEN
--     RAISE EXCEPTION 'Expected ordinary-mode role guard definition is absent; bootstrap stopped.';
--   END IF;
--
--   SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
--   IF v_admin_count = 1 AND v_profile_role = 'admin' THEN
--     RAISE NOTICE 'This exact target is already the sole admin; no change made.';
--     RETURN;
--   ELSIF v_admin_count <> 0 OR v_profile_role <> 'student' THEN
--     RAISE EXCEPTION 'Bootstrap requires zero existing admins and the verified target to have role student.';
--   END IF;
--
--   ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_role_escalation;
--   UPDATE public.profiles SET role = 'admin', updated_at = NOW()
--   WHERE id = v_target_id AND lower(email) = lower(v_expected_email) AND role = 'student';
--   GET DIAGNOSTICS v_updated = ROW_COUNT;
--   IF v_updated <> 1 THEN
--     RAISE EXCEPTION 'Expected to promote exactly one verified student profile; updated % rows.', v_updated;
--   END IF;
--   ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_role_escalation;
--
--   SELECT t.tgenabled INTO v_trigger_mode
--   FROM pg_trigger t
--   JOIN pg_class c ON c.oid = t.tgrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relname = 'profiles'
--     AND t.tgname = 'trg_prevent_role_escalation' AND NOT t.tgisinternal;
--   IF v_trigger_mode IS DISTINCT FROM 'O' THEN
--     RAISE EXCEPTION 'Role-change trigger was not restored; transaction must roll back.';
--   END IF;
-- END;
-- $bootstrap$;
-- COMMIT;
--
-- Verify after commit:
--   SELECT id, email, role FROM public.profiles
--   WHERE id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
--   SELECT t.tgname, t.tgenabled
--   FROM pg_trigger t
--   JOIN pg_class c ON c.oid = t.tgrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relname = 'profiles'
--     AND t.tgname = 'trg_prevent_role_escalation' AND NOT t.tgisinternal;
--
-- Rollback considerations:
-- - The migration is transactional; a preflight or replacement failure rolls it back.
-- - Do not restore the old metadata-driven signup function; that reopens privilege
--   assignment through public signup metadata. If signup behavior regresses, keep
--   the fixed student default and repair only the affected profile-field logic.
-- - The bootstrap is separately transactional. A failure rolls back the promotion
--   and trigger disable/enable statements together. If the bootstrap committed for
--   the wrong identity, use the same trusted SQL Editor context to demote only that
--   verified profile after reviewing active policy/trigger behavior.
