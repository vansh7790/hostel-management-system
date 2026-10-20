-- Roll back the verified Auth-to-student linking behavior.
-- Already-created students.user_id links are retained as valid identity data;
-- this rollback removes automatic linking and restores the former identity guard.

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'auth.users'::regclass
      AND t.tgname = 'zz_link_verified_student_after_auth_insert'
      AND t.tgfoid = 'private.handle_verified_student_auth_link()'::regprocedure
      AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'auth.users'::regclass
      AND t.tgname = 'zz_link_verified_student_after_auth_confirmation'
      AND t.tgfoid = 'private.handle_verified_student_auth_link()'::regprocedure
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Expected verified student-linking triggers are missing; rollback stopped.';
  END IF;

  IF pg_catalog.to_regprocedure('private.is_verified_student_identity_link(uuid,uuid)') IS NULL
     OR pg_catalog.to_regprocedure('private.link_verified_student_profile(uuid)') IS NULL
     OR pg_catalog.to_regprocedure('private.prevent_student_identity_reassignment()') IS NULL
     OR pg_catalog.to_regclass('public.uq_students_normalized_email') IS NULL THEN
    RAISE EXCEPTION 'Expected migration functions are missing; rollback stopped.';
  END IF;
END;
$preflight$;

DROP TRIGGER zz_link_verified_student_after_auth_insert ON auth.users;
DROP TRIGGER zz_link_verified_student_after_auth_confirmation ON auth.users;

-- Restore the previous guard behavior and its reviewed search_path setting.
CREATE OR REPLACE FUNCTION private.prevent_student_identity_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.is_admin()
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
    RAISE EXCEPTION 'Permission denied: Student identity fields cannot be reassigned.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP FUNCTION private.handle_verified_student_auth_link();
DROP FUNCTION private.link_verified_student_profile(uuid);
DROP FUNCTION private.is_verified_student_identity_link(uuid, uuid);
DROP INDEX public.uq_students_normalized_email;

COMMIT;
