-- Complaint workflow integrity (mirrors the existing leave workflow guard).
--
-- Fixes two confirmed gaps (PGlite-tested):
--   1. A student could insert a complaint that is already 'in_progress' or
--      'resolved', bypassing the warden queue.
--   2. A warden (any non-owner, non-admin) could rewrite a student's complaint
--      title/description/category while updating its status.
--
-- After this migration:
--   * Non-admin authenticated INSERTs are always stored as 'pending'.
--   * Non-admin, non-owner UPDATEs may change only status (and updated_at).
--   * The owning student keeps the existing RLS rights (edit while pending,
--     cannot change status); admins and trusted database execution
--     (auth.uid() IS NULL: SQL Editor, seeds, FK actions) are unaffected.
--
-- Adds one function and two triggers; changes no RLS policy and no data.
-- Idempotent (CREATE OR REPLACE). Run as postgres in the SQL Editor.

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Run this migration as postgres without an end-user JWT; migration stopped.';
  END IF;
  IF pg_catalog.to_regclass('public.complaints') IS NULL THEN
    RAISE EXCEPTION 'Expected public.complaints; migration stopped.';
  END IF;
  IF pg_catalog.to_regprocedure('private.is_admin()') IS NULL
     OR pg_catalog.to_regprocedure('private.get_current_student_id()') IS NULL THEN
    RAISE EXCEPTION 'Expected private.is_admin() and private.get_current_student_id(); migration stopped.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION private.enforce_complaint_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR private.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- New complaints always enter the queue as pending.
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  -- The owning student's edits are governed by RLS (pending only, status fixed).
  IF OLD.student_id = private.get_current_student_id() THEN
    RETURN NEW;
  END IF;

  -- Wardens (and any other permitted non-owner) may change only the status.
  IF (pg_catalog.to_jsonb(NEW) - ARRAY['status', 'updated_at']::text[])
     IS DISTINCT FROM
     (pg_catalog.to_jsonb(OLD) - ARRAY['status', 'updated_at']::text[]) THEN
    RAISE EXCEPTION 'Permission denied: only the complaint status can be changed by staff.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION private.enforce_complaint_workflow() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_complaint_workflow() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_enforce_complaint_workflow_insert
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION private.enforce_complaint_workflow();

CREATE OR REPLACE TRIGGER trg_enforce_complaint_workflow_update
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION private.enforce_complaint_workflow();

COMMIT;

-- Read-only verification (run separately):
-- SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_enforce_complaint_workflow_%';
