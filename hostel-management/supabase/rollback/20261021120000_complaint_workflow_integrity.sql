-- Roll back 20261021120000_complaint_workflow_integrity.sql.
-- Removes only the two triggers and the function it added; no data changes.
-- Run as postgres in the SQL Editor.

BEGIN;

DROP TRIGGER IF EXISTS trg_enforce_complaint_workflow_insert ON public.complaints;
DROP TRIGGER IF EXISTS trg_enforce_complaint_workflow_update ON public.complaints;
DROP FUNCTION IF EXISTS private.enforce_complaint_workflow();

COMMIT;
