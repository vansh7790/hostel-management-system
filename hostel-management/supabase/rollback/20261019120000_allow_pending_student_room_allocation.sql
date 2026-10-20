-- REVIEW PROPOSAL ONLY. Do not run unless rolling back the migration.
-- Restores the prior guard/policy authorization behavior. The old deployed
-- guard used search_path=public, pg_temp; this rollback deliberately retains
-- search_path='' as a security improvement. It is not an exact restoration
-- of the function settings or exception wording.

BEGIN;

DO $preflight$
DECLARE
  v_owner name;
  v_guard_src text;
BEGIN
  SELECT r.rolname, p.prosrc INTO v_owner, v_guard_src
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'private'
    AND p.proname = 'prevent_student_self_allocation_changes'
    AND p.pronargs = 0;

  IF v_owner IS DISTINCT FROM 'postgres'
     OR lower(v_guard_src) NOT LIKE '%old.intended_hostel_id%'
     OR lower(v_guard_src) NOT LIKE '%to_jsonb%' THEN
    RAISE EXCEPTION 'Expected allocation migration guard is missing or differs; inspect before rollback.';
  END IF;
  IF NOT pg_catalog.pg_has_role(current_user, 'postgres', 'USAGE')
     AND NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'Rollback role cannot replace the postgres-owned guard.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'students'
      AND p.polname = 'students_update_admin_warden_or_self' AND p.polcmd = 'w'
  ) THEN
    RAISE EXCEPTION 'Expected student UPDATE policy is missing; inspect before rollback.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION private.prevent_student_self_allocation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Preserve the original no-op condition: authorization raises only when an
  -- allocation value actually changes.
  IF NEW.room_id IS NOT DISTINCT FROM OLD.room_id
     AND NEW.hostel_id IS NOT DISTINCT FROM OLD.hostel_id THEN
    RETURN NEW;
  END IF;

  IF private.is_admin() OR private.is_warden_for_hostel(OLD.hostel_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: only an admin or the assigned warden may change room allocation.'
    USING ERRCODE = '42501';
END;
$function$;

ALTER POLICY students_update_admin_warden_or_self
  ON public.students
  USING (
    private.is_admin()
    OR private.is_warden_for_hostel(hostel_id)
    OR user_id = auth.uid()
  )
  WITH CHECK (
    private.is_admin()
    OR private.is_warden_for_hostel(hostel_id)
    OR (
      user_id = auth.uid()
      AND room_id IS NOT DISTINCT FROM private.get_student_room_id(id)
      AND hostel_id IS NOT DISTINCT FROM private.get_student_hostel_id(id)
    )
  );

COMMIT;
