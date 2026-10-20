-- REVIEW PROPOSAL ONLY. Do not run until reviewed and approved.
-- Allows an assigned warden to allocate a pending student only to a room in
-- that student's intended hostel. Existing allocation/occupancy triggers stay.

BEGIN;

DO $preflight$
DECLARE
  v_guard oid;
  v_owner name;
  v_policy_using text;
  v_policy_check text;
  v_other_update_policy text;
BEGIN
  SELECT p.oid, r.rolname INTO v_guard, v_owner
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'private'
    AND p.proname = 'prevent_student_self_allocation_changes'
    AND p.pronargs = 0;

  IF v_guard IS NULL OR v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'Expected postgres-owned private allocation guard is missing.';
  END IF;
  IF NOT (SELECT p.prosecdef
                 AND p.proconfig @> ARRAY['search_path=public, pg_temp']::text[]
          FROM pg_catalog.pg_proc p WHERE p.oid = v_guard) IS TRUE THEN
    RAISE EXCEPTION 'Allocation guard security attributes differ from the reviewed live function.';
  END IF;
  IF pg_catalog.has_function_privilege('authenticated', v_guard, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_guard, 'EXECUTE') THEN
    RAISE EXCEPTION 'Allocation guard has unexpected API EXECUTE privileges.';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.aclexplode(
        (SELECT p.proacl FROM pg_catalog.pg_proc p WHERE p.oid = v_guard)
      )) <> 1
     OR EXISTS (
       SELECT 1 FROM pg_catalog.aclexplode(
         (SELECT p.proacl FROM pg_catalog.pg_proc p WHERE p.oid = v_guard)
       ) acl
       WHERE acl.grantee <> (SELECT p.proowner FROM pg_catalog.pg_proc p WHERE p.oid = v_guard)
          OR acl.privilege_type <> 'EXECUTE'
          OR acl.is_grantable
     ) THEN
    RAISE EXCEPTION 'Allocation guard ACL differs from the reviewed owner-only EXECUTE ACL.';
  END IF;
  IF NOT pg_catalog.pg_has_role(current_user, 'postgres', 'USAGE')
     AND NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'Migration role cannot replace the postgres-owned guard.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'students'
      AND t.tgname = 'trg_prevent_student_self_allocation_changes'
      AND t.tgfoid = v_guard AND t.tgenabled <> 'D' AND NOT t.tgisinternal
      AND (t.tgtype & 2) = 2 AND (t.tgtype & 16) = 16
      AND lower(pg_catalog.pg_get_triggerdef(t.oid, true)) LIKE '%update of room_id, hostel_id%'
  ) THEN
    RAISE EXCEPTION 'Expected enabled allocation-guard trigger is missing or differs.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_proc f ON f.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace fn ON fn.oid = f.pronamespace
    WHERE n.nspname = 'public' AND c.relname = 'students'
      AND t.tgname = 'trg_validate_student_room_update'
      AND fn.nspname = 'private' AND f.proname = 'check_student_room_allocation'
      AND t.tgenabled <> 'D' AND NOT t.tgisinternal
      AND (t.tgtype & 2) = 2 AND (t.tgtype & 16) = 16
      AND lower(pg_catalog.pg_get_triggerdef(t.oid, true)) LIKE '%update of room_id, hostel_id%'
  ) THEN
    RAISE EXCEPTION 'Expected enabled room-validation trigger is missing or differs.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_proc f ON f.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace fn ON fn.oid = f.pronamespace
    WHERE n.nspname = 'public' AND c.relname = 'students'
      AND t.tgname = 'trg_prevent_student_identity_reassignment'
      AND fn.nspname = 'private' AND f.proname = 'prevent_student_identity_reassignment'
      AND t.tgenabled <> 'D' AND NOT t.tgisinternal
      AND (t.tgtype & 2) = 2 AND (t.tgtype & 16) = 16
      AND lower(pg_catalog.pg_get_triggerdef(t.oid, true)) LIKE '%update of user_id, student_id%'
  ) THEN
    RAISE EXCEPTION 'Expected enabled identity-protection trigger is missing or differs.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_proc f ON f.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace fn ON fn.oid = f.pronamespace
    WHERE n.nspname = 'public' AND c.relname = 'students'
      AND t.tgname = 'trg_sync_room_occupancy_update'
      AND fn.nspname = 'private' AND f.proname = 'sync_room_occupancy'
      AND t.tgenabled <> 'D' AND NOT t.tgisinternal
      AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 0 AND (t.tgtype & 16) = 16
  ) THEN
    RAISE EXCEPTION 'Expected enabled AFTER room-occupancy trigger is missing or differs.';
  END IF;

  SELECT pg_catalog.pg_get_expr(p.polqual, p.polrelid),
         pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
    INTO v_policy_using, v_policy_check
  FROM pg_catalog.pg_policy p
  JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'students'
    AND p.polname = 'students_update_admin_warden_or_self'
    AND p.polcmd = 'w' AND p.polpermissive
    AND p.polroles = ARRAY['authenticated'::regrole::oid];
  IF v_policy_using IS NULL OR v_policy_check IS NULL THEN
    RAISE EXCEPTION 'Expected permissive authenticated student UPDATE policy is missing.';
  END IF;
  IF lower(v_policy_using) NOT LIKE '%private.is_admin()%'
     OR lower(v_policy_using) NOT LIKE '%private.is_warden_for_hostel(hostel_id)%'
     OR lower(v_policy_using) NOT LIKE '%user_id = auth.uid()%'
     OR lower(v_policy_check) NOT LIKE '%private.is_admin()%'
     OR lower(v_policy_check) NOT LIKE '%private.get_student_room_id(id)%'
     OR lower(v_policy_check) NOT LIKE '%private.get_student_hostel_id(id)%' THEN
    RAISE EXCEPTION 'Student UPDATE policy no longer contains the reviewed admin/warden/self branches.';
  END IF;

  SELECT p.polname INTO v_other_update_policy
  FROM pg_catalog.pg_policy p
  JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'students'
    AND p.polcmd IN ('w', '*')
    AND (0::oid = ANY(p.polroles) OR 'authenticated'::regrole::oid = ANY(p.polroles))
    AND p.polname <> 'students_update_admin_warden_or_self'
  LIMIT 1;
  IF v_other_update_policy IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected additional student UPDATE policy %; inspect before applying.', v_other_update_policy;
  END IF;

  IF pg_catalog.to_regclass('public.students') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_attribute
       WHERE attrelid = 'public.students'::regclass
         AND attname = 'intended_hostel_id' AND NOT attisdropped
     ) THEN
    RAISE EXCEPTION 'Expected students table or intended_hostel_id column is missing.';
  END IF;
END;
$preflight$;

-- The trigger is SECURITY DEFINER, owned by postgres, and owner-only executable
-- in the inspected deployment. Keep that owner/ACL, but use an empty search_path
-- and qualify every referenced object. No-op allocation-column updates retain
-- their prior behavior. The existing-warden branch below applies only when the
-- OLD actual hostel is assigned; pending rows have OLD.hostel_id NULL.
CREATE OR REPLACE FUNCTION private.prevent_student_self_allocation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_target_hostel_id uuid;
BEGIN
  IF NEW.room_id IS NOT DISTINCT FROM OLD.room_id
     AND NEW.hostel_id IS NOT DISTINCT FROM OLD.hostel_id THEN
    RETURN NEW;
  END IF;

  IF private.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Preserve existing permissions for wardens managing already allocated
  -- students in their actual hostel. A pending student cannot pass this branch.
  IF private.is_warden_for_hostel(OLD.hostel_id) THEN
    RETURN NEW;
  END IF;

  IF OLD.room_id IS NULL
     AND OLD.hostel_id IS NULL
     AND OLD.intended_hostel_id IS NOT NULL
     AND private.is_warden_for_hostel(OLD.intended_hostel_id) THEN
    IF NEW.room_id IS NULL THEN
      RAISE EXCEPTION 'Pending allocation must assign a room.' USING ERRCODE = '22023';
    END IF;

    -- Check the target room directly. Do not depend on whether this trigger
    -- runs before or after the validator that derives NEW.hostel_id.
    SELECT r.hostel_id INTO v_target_hostel_id
    FROM public.rooms AS r
    WHERE r.id = NEW.room_id;
    IF NOT FOUND OR v_target_hostel_id IS DISTINCT FROM OLD.intended_hostel_id THEN
      RAISE EXCEPTION 'Selected room must belong to the student intended hostel.'
        USING ERRCODE = '23514';
    END IF;

    -- Permit only room_id plus the validator-derived hostel_id to change.
    -- This JSON row comparison covers all current and future student columns.
    IF (pg_catalog.to_jsonb(NEW) - ARRAY['room_id', 'hostel_id']::text[])
       IS DISTINCT FROM
       (pg_catalog.to_jsonb(OLD) - ARRAY['room_id', 'hostel_id']::text[]) THEN
      RAISE EXCEPTION 'Pending allocation cannot change other student fields.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: only an admin or the assigned warden may change room allocation.'
    USING ERRCODE = '42501';
END;
$function$;

-- USING checks the existing row: the new warden branch is limited to pending
-- rows whose intended hostel is assigned to this caller. WITH CHECK validates
-- the resulting row after all BEFORE triggers: the selected room's derived
-- actual hostel must equal the intended hostel. The guard additionally checks
-- OLD.intended_hostel_id and blocks every unrelated field change.
ALTER POLICY students_update_admin_warden_or_self
  ON public.students
  USING (
    private.is_admin()
    OR private.is_warden_for_hostel(hostel_id)
    OR user_id = auth.uid()
    OR (
      room_id IS NULL
      AND hostel_id IS NULL
      AND intended_hostel_id IS NOT NULL
      AND private.is_warden_for_hostel(intended_hostel_id)
    )
  )
  WITH CHECK (
    private.is_admin()
    OR private.is_warden_for_hostel(hostel_id)
    OR (
      user_id = auth.uid()
      AND room_id IS NOT DISTINCT FROM private.get_student_room_id(id)
      AND hostel_id IS NOT DISTINCT FROM private.get_student_hostel_id(id)
    )
    OR (
      room_id IS NOT NULL
      AND intended_hostel_id IS NOT NULL
      AND hostel_id = intended_hostel_id
      AND private.is_warden_for_hostel(intended_hostel_id)
    )
  );

COMMIT;
