-- HOSTEL MANAGEMENT SYSTEM
-- Proposed security, privilege, RLS, and allocation hardening migration
-- Date: 2026-10-18
--
-- REVIEW ONLY. Do not run automatically.
-- This file does not create/drop application tables, repair existing rows, seed
-- data, reset data, or change auth users. It assumes the seven base tables from
-- schema.sql already exist in the target database.
--
-- This migration changes policies, function definitions/privileges, and
-- triggers. Review it with the project owner/database administrator first.
-- Apply only after the preflight queries and role-based tests are approved.
--
-- Bootstrap rule:
-- - New auth users always receive role 'student'. Signup metadata cannot grant
--   admin or warden access.
-- - A trusted SQL Editor/postgres operation must promote an existing profile to
--   admin or warden after the identity is known.
-- - Trusted SQL execution must be protected. This migration does not provide a
--   browser-callable role-promotion RPC.

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Preconditions and complete policy inventory
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
    OR to_regclass('public.hostels') IS NULL
    OR to_regclass('public.rooms') IS NULL
    OR to_regclass('public.students') IS NULL
    OR to_regclass('public.complaints') IS NULL
    OR to_regclass('public.leave_requests') IS NULL
    OR to_regclass('public.notices') IS NULL THEN
    RAISE EXCEPTION 'Base hostel schema is incomplete; apply/reconcile schema.sql before this hardening migration.';
  END IF;
END;
$$;

-- Mandatory API exposure gate. Supabase normally exposes `public` and does not
-- expose `private`. If this setting is unavailable, fail closed and verify it
-- manually in Dashboard > Settings > API > Exposed schemas before applying.
DO $$
DECLARE
  v_exposed_schemas TEXT;
BEGIN
  v_exposed_schemas := current_setting('pgrst.db_schemas', true);
    IF v_exposed_schemas IS NULL
      OR btrim(v_exposed_schemas) = ''
     OR 'private' = ANY(regexp_split_to_array(v_exposed_schemas, '\s*,\s*')) THEN
    RAISE EXCEPTION 'PostgREST exposure gate failed: private must not be in pgrst.db_schemas; verify Dashboard > Settings > API > Exposed schemas.';
  END IF;
END;
$$;

-- The privilege revocations and trigger rewiring below require the original
-- function signatures from schema.sql. Abort rather than partially applying
-- against a different live schema.
DO $$
BEGIN
  IF to_regprocedure('public.get_auth_role()') IS NULL
    OR to_regprocedure('public.is_admin()') IS NULL
    OR to_regprocedure('public.is_warden()') IS NULL
    OR to_regprocedure('public.get_current_student_id()') IS NULL
    OR to_regprocedure('public.is_warden_for_hostel(uuid)') IS NULL
    OR to_regprocedure('public.check_student_room_allocation()') IS NULL
    OR to_regprocedure('public.sync_room_occupancy()') IS NULL
    OR to_regprocedure('public.handle_new_user()') IS NULL
    OR to_regprocedure('public.prevent_profile_role_escalation()') IS NULL THEN
    RAISE EXCEPTION 'Expected schema.sql helper functions are missing or have incompatible signatures.';
  END IF;
END;
$$;

-- Abort instead of silently leaving an unreviewed policy active. The list
-- includes names from schema.sql and names introduced by the earlier proposal.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'hostels', 'rooms', 'students', 'complaints', 'leave_requests', 'notices')
      AND policyname NOT IN (
        'profiles_select_all_authenticated', 'profiles_update_own', 'profiles_insert_own',
        'profiles_select_scoped', 'profiles_insert_admin',
        'hostels_select_authenticated', 'hostels_insert_admin',
        'hostels_update_admin_or_warden', 'hostels_delete_admin', 'hostels_select_scoped',
        'rooms_select_authenticated', 'rooms_insert_admin_or_warden',
        'rooms_update_admin_or_warden', 'rooms_delete_admin', 'rooms_select_scoped',
        'students_select_authenticated', 'students_insert_admin',
        'students_update_admin_warden_or_self', 'students_delete_admin', 'students_select_scoped',
        'complaints_select', 'complaints_insert', 'complaints_update', 'complaints_delete',
        'complaints_select_scoped', 'complaints_insert_scoped', 'complaints_update_scoped', 'complaints_delete_scoped',
        'leave_select', 'leave_insert_student', 'leave_update_status', 'leave_delete',
        'leave_select_scoped', 'leave_insert_scoped', 'leave_update_scoped', 'leave_delete_scoped',
        'notices_select_all', 'notices_insert_admin_or_warden',
        'notices_update_admin_or_warden', 'notices_delete_admin_or_warden', 'notices_select_scoped',
        'notices_insert_scoped', 'notices_update_scoped', 'notices_delete_scoped'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected policy found on hostel tables; inspect pg_policies before applying hardening migration.';
  END IF;
END;
$$;

-- Run this read-only inventory before approving the migration. It lists every
-- policy currently visible on all seven tables, including policies added outside
-- schema.sql. Do not proceed silently if unexpected policies are present.
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles', 'hostels', 'rooms', 'students', 'complaints', 'leave_requests', 'notices')
-- ORDER BY tablename, policyname;
--
-- Expected policies from schema.sql, all explicitly reconciled below:
-- profiles: profiles_select_all_authenticated, profiles_update_own, profiles_insert_own
-- hostels: hostels_select_authenticated, hostels_insert_admin,
--          hostels_update_admin_or_warden, hostels_delete_admin
-- rooms: rooms_select_authenticated, rooms_insert_admin_or_warden,
--        rooms_update_admin_or_warden, rooms_delete_admin
-- students: students_select_authenticated, students_insert_admin,
--           students_update_admin_warden_or_self, students_delete_admin
-- complaints: complaints_select, complaints_insert, complaints_update, complaints_delete
-- leave_requests: leave_select, leave_insert_student, leave_update_status, leave_delete
-- notices: notices_select_all, notices_insert_admin_or_warden,
--          notices_update_admin_or_warden, notices_delete_admin_or_warden
--
-- Reconciliation decision:
-- - All 27 expected policies above are removed and recreated with the same
--   operation coverage, except permissive predicates are replaced.
-- - No expected policy is retained unchanged.
-- - Any additional policy found by the inventory query must be reviewed and
--   explicitly dropped or incorporated before applying this file.
--
-- Additional preflight queries. These read data only and intentionally do not
-- repair it:
-- SELECT role, COUNT(*) FROM public.profiles GROUP BY role ORDER BY role;
-- SELECT id, email, role FROM public.profiles WHERE role IN ('admin', 'warden');
-- SELECT id, name, warden_id FROM public.hostels ORDER BY name;
-- SELECT id, room_id, hostel_id, current_occupants, capacity, status
-- FROM public.rooms
-- WHERE current_occupants <> (SELECT COUNT(*) FROM public.students s WHERE s.room_id = rooms.id)
--    OR (status = 'full' AND current_occupants < capacity)
--    OR (status = 'available' AND current_occupants >= capacity);
--
-- Function/trigger inventory queries:
-- SELECT n.nspname AS schema_name, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
--        p.prosecdef, r.rolname AS owner
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- JOIN pg_roles r ON r.oid = p.proowner
-- WHERE (n.nspname = 'public' AND p.proname IN (
--   'check_student_room_allocation', 'sync_room_occupancy', 'handle_new_user',
--   'prevent_profile_role_escalation', 'get_auth_role', 'is_admin', 'is_warden',
--   'get_current_student_id', 'is_warden_for_hostel'))
--    OR n.nspname = 'private';
-- SELECT event_object_schema, event_object_table, trigger_name, action_timing,
--        event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE (event_object_schema = 'public' AND event_object_table IN (
--   'profiles', 'rooms', 'students', 'complaints', 'leave_requests', 'notices'))
--    OR (event_object_schema = 'auth' AND event_object_table = 'users')
-- ORDER BY event_object_table, trigger_name;
--
-- Supabase API exposure check. The private schema must not be in the exposed
-- PostgREST schema list. Confirm this in project API settings as well.
-- SELECT current_setting('pgrst.db_schemas', true) AS postgrest_exposed_schemas;

-- -----------------------------------------------------------------------------
-- 1. Private policy helpers and function privileges
-- -----------------------------------------------------------------------------
-- Supabase normally exposes public, not private, to PostgREST. These helpers
-- are therefore moved to private so they can support RLS without being ordinary
-- public RPC endpoints. If the target project exposes private through PostgREST,
-- stop and reconfigure API exposure before applying this migration.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.is_warden()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'warden'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.get_current_student_id()
RETURNS UUID AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.is_warden_for_hostel(p_hostel_id UUID)
RETURNS BOOLEAN AS $$
  SELECT private.is_admin()
    OR (
      private.is_warden()
      AND EXISTS (
        SELECT 1 FROM public.hostels h
        WHERE h.id = p_hostel_id AND h.warden_id = auth.uid()
      )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.is_student_for_hostel(p_hostel_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid() AND s.hostel_id = p_hostel_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.get_student_room_id(p_student_id UUID)
RETURNS UUID AS $$
  SELECT s.room_id FROM public.students s WHERE s.id = p_student_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.get_student_hostel_id(p_student_id UUID)
RETURNS UUID AS $$
  SELECT s.hostel_id FROM public.students s WHERE s.id = p_student_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.is_warden_for_student(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT private.is_warden_for_hostel(private.get_student_hostel_id(p_student_id));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.can_access_student_record(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT private.is_admin()
    OR p_student_id = private.get_current_student_id()
    OR private.is_warden_for_student(p_student_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.can_view_profile(p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT auth.uid() = p_profile_id
    OR private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.hostels h
      JOIN public.students s ON s.hostel_id = h.id AND s.user_id = p_profile_id
      WHERE h.warden_id = auth.uid()
        AND private.is_warden()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- RLS policy evaluation runs as the authenticated role, so these helpers need
-- EXECUTE for authenticated. This is the narrow exception to direct exposure:
-- private must remain absent from the PostgREST exposed-schema list. No anon
-- execution is granted. Trigger-only functions below receive no client grants.
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_warden() TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_warden_for_hostel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_student_for_hostel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_student_room_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_student_hostel_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_warden_for_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_student_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_profile(UUID) TO authenticated;

-- Existing public SECURITY DEFINER helpers are no longer used by the policies.
-- Remove browser/RPC execution while retaining their names for compatibility
-- with any separately reviewed server-side tooling. Trigger functions are also
-- revoked because PostgreSQL trigger execution does not require client EXECUTE.
REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_warden() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_current_student_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_warden_for_hostel(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_student_room_allocation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_room_occupancy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Trigger functions: auth, role, ownership, approval, and authorship
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.handle_new_user()
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
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: Cannot modify user role.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.prevent_student_identity_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.is_admin()
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
    RAISE EXCEPTION 'Permission denied: Student identity fields cannot be reassigned.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.prevent_request_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.is_admin()
     AND NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Permission denied: Request ownership cannot be reassigned.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.enforce_complaint_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_student_room_id UUID;
  v_student_hostel_id UUID;
BEGIN
  SELECT room_id, hostel_id
  INTO v_student_room_id, v_student_hostel_id
  FROM public.students
  WHERE id = NEW.student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint student does not exist.';
  END IF;

  IF NEW.room_id IS DISTINCT FROM v_student_room_id THEN
    RAISE EXCEPTION 'Complaint room must match the student current room.';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
    IF NEW.student_id <> private.get_current_student_id()
       AND NOT private.is_warden_for_hostel(v_student_hostel_id) THEN
      RAISE EXCEPTION 'Permission denied: Complaint is outside your hostel scope.';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.room_id IS DISTINCT FROM OLD.room_id THEN
      RAISE EXCEPTION 'Permission denied: Complaint room cannot be reassigned.';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Permission denied: Complaint ownership cannot be reassigned.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.set_notice_author()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.posted_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.enforce_leave_workflow()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.approved_by := NULL;
    NEW.remark := NULL;
    IF auth.uid() IS NOT NULL
       AND NOT private.is_admin()
       AND NEW.student_id <> private.get_current_student_id() THEN
      RAISE EXCEPTION 'Permission denied: Leave request must belong to the current student.';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('approved', 'rejected')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Permission denied: Finalized leave requests cannot change status.';
  END IF;

  IF private.is_admin() THEN
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
      NEW.approved_by := auth.uid();
    ELSIF NEW.status = 'pending' THEN
      NEW.approved_by := NULL;
      NEW.remark := NULL;
    ELSIF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'Permission denied: approved_by is immutable after approval.';
    END IF;
    RETURN NEW;
  END IF;

  IF private.is_warden_for_student(OLD.student_id) THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Permission denied: Request ownership cannot be reassigned.';
    END IF;
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Permission denied: Warden cannot edit a finalized leave request.';
    END IF;
    IF NEW.status IN ('approved', 'rejected') THEN
      NEW.approved_by := auth.uid();
    ELSIF NEW.status = 'pending' THEN
      NEW.approved_by := NULL;
      NEW.remark := NULL;
    ELSE
      RAISE EXCEPTION 'Permission denied: Invalid leave status transition.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.student_id = private.get_current_student_id() THEN
    IF OLD.status <> 'pending'
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.remark IS DISTINCT FROM OLD.remark
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'Permission denied: Students cannot approve, reject, or remark on leave requests.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Permission denied: Leave request is outside your scope.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.normalize_room_occupancy()
RETURNS TRIGGER AS $$
DECLARE
  v_occupants INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_occupants
  FROM public.students s
  WHERE s.room_id = NEW.id;

  IF v_occupants > NEW.capacity THEN
    RAISE EXCEPTION 'Room capacity (%) is below current occupancy (%).', NEW.capacity, v_occupants;
  END IF;

  NEW.current_occupants := v_occupants;
  NEW.status := CASE
    WHEN NEW.status = 'maintenance' THEN 'maintenance'
    WHEN v_occupants >= NEW.capacity THEN 'full'
    ELSE 'available'
  END;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.check_student_room_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_room_capacity INTEGER;
  v_room_hostel_id UUID;
  v_current_count INTEGER;
BEGIN
  IF NEW.room_id IS NULL THEN
    NEW.hostel_id := NULL;
    RETURN NEW;
  END IF;

  -- Row-level locking serializes concurrent allocations to the same room.
  -- Lock old and new rooms in UUID order during transfers to avoid a
  -- two-transaction deadlock when two students swap rooms concurrently.
  IF TG_OP = 'UPDATE'
     AND OLD.room_id IS NOT NULL
     AND OLD.room_id IS DISTINCT FROM NEW.room_id THEN
    PERFORM id
    FROM public.rooms
    WHERE id IN (OLD.room_id, NEW.room_id)
    ORDER BY id
    FOR UPDATE;
  ELSE
    PERFORM id
    FROM public.rooms
    WHERE id = NEW.room_id
    FOR UPDATE;
  END IF;

  SELECT capacity, hostel_id INTO v_room_capacity, v_room_hostel_id
  FROM public.rooms
  WHERE id = NEW.room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target room does not exist.';
  END IF;

  NEW.hostel_id := v_room_hostel_id;

  SELECT COUNT(*) INTO v_current_count
  FROM public.students
  WHERE room_id = NEW.room_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF (v_current_count + 1) > v_room_capacity THEN
    RAISE EXCEPTION 'Room allocation failed: Room capacity (%) would be exceeded.', v_room_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION private.sync_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.room_id IS NOT NULL) OR (TG_OP = 'DELETE' AND OLD.room_id IS NOT NULL) THEN
    UPDATE public.rooms
    SET current_occupants = (SELECT COUNT(*) FROM public.students WHERE room_id = OLD.room_id),
        status = CASE
          WHEN status = 'maintenance' THEN 'maintenance'
          WHEN (SELECT COUNT(*) FROM public.students WHERE room_id = OLD.room_id) >= capacity THEN 'full'
          ELSE 'available'
        END,
        updated_at = NOW()
    WHERE id = OLD.room_id;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.room_id IS NOT NULL THEN
    UPDATE public.rooms
    SET current_occupants = (SELECT COUNT(*) FROM public.students WHERE room_id = NEW.room_id),
        status = CASE
          WHEN status = 'maintenance' THEN 'maintenance'
          WHEN (SELECT COUNT(*) FROM public.students WHERE room_id = NEW.room_id) >= capacity THEN 'full'
          ELSE 'available'
        END,
        updated_at = NOW()
    WHERE id = NEW.room_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- No EXECUTE is granted to authenticated/anon for private trigger functions.
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_student_identity_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_request_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_complaint_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_notice_author() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_leave_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.normalize_room_occupancy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.check_student_room_allocation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_room_occupancy() FROM PUBLIC, anon, authenticated;

-- Rewire all existing trigger names to private trigger functions.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.prevent_profile_role_escalation();

DROP TRIGGER IF EXISTS trg_prevent_student_identity_reassignment ON public.students;
CREATE TRIGGER trg_prevent_student_identity_reassignment
  BEFORE UPDATE OF user_id, student_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.prevent_student_identity_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_complaint_reassignment ON public.complaints;
CREATE TRIGGER trg_prevent_complaint_reassignment
  BEFORE UPDATE OF student_id ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION private.prevent_request_reassignment();

DROP TRIGGER IF EXISTS trg_enforce_complaint_integrity ON public.complaints;
DROP TRIGGER IF EXISTS trg_enforce_complaint_integrity_insert ON public.complaints;
CREATE TRIGGER trg_enforce_complaint_integrity_insert
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION private.enforce_complaint_integrity();

DROP TRIGGER IF EXISTS trg_enforce_complaint_integrity_update ON public.complaints;
CREATE TRIGGER trg_enforce_complaint_integrity_update
  BEFORE UPDATE OF student_id, room_id ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION private.enforce_complaint_integrity();

DROP TRIGGER IF EXISTS trg_prevent_leave_reassignment ON public.leave_requests;
CREATE TRIGGER trg_prevent_leave_reassignment
  BEFORE UPDATE OF student_id ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION private.prevent_request_reassignment();

DROP TRIGGER IF EXISTS trg_set_notice_author ON public.notices;
CREATE TRIGGER trg_set_notice_author
  BEFORE INSERT ON public.notices
  FOR EACH ROW EXECUTE FUNCTION private.set_notice_author();

DROP TRIGGER IF EXISTS trg_enforce_leave_workflow ON public.leave_requests;
DROP TRIGGER IF EXISTS trg_enforce_leave_workflow_insert ON public.leave_requests;
CREATE TRIGGER trg_enforce_leave_workflow_insert
  BEFORE INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION private.enforce_leave_workflow();

DROP TRIGGER IF EXISTS trg_enforce_leave_workflow_update ON public.leave_requests;
CREATE TRIGGER trg_enforce_leave_workflow_update
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION private.enforce_leave_workflow();

DROP TRIGGER IF EXISTS trg_normalize_room_occupancy ON public.rooms;
DROP TRIGGER IF EXISTS trg_normalize_room_occupancy_insert ON public.rooms;
CREATE TRIGGER trg_normalize_room_occupancy_insert
  BEFORE INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION private.normalize_room_occupancy();

DROP TRIGGER IF EXISTS trg_normalize_room_occupancy_update ON public.rooms;
CREATE TRIGGER trg_normalize_room_occupancy_update
  BEFORE UPDATE OF capacity, current_occupants, status ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION private.normalize_room_occupancy();

DROP TRIGGER IF EXISTS trg_validate_student_room ON public.students;
DROP TRIGGER IF EXISTS trg_validate_student_room_insert ON public.students;
CREATE TRIGGER trg_validate_student_room_insert
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.check_student_room_allocation();

DROP TRIGGER IF EXISTS trg_validate_student_room_update ON public.students;
CREATE TRIGGER trg_validate_student_room_update
  BEFORE UPDATE OF room_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.check_student_room_allocation();

DROP TRIGGER IF EXISTS trg_sync_room_occupancy ON public.students;
DROP TRIGGER IF EXISTS trg_sync_room_occupancy_insert ON public.students;
CREATE TRIGGER trg_sync_room_occupancy_insert
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.sync_room_occupancy();

DROP TRIGGER IF EXISTS trg_sync_room_occupancy_update ON public.students;
CREATE TRIGGER trg_sync_room_occupancy_update
  AFTER UPDATE OF room_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.sync_room_occupancy();

DROP TRIGGER IF EXISTS trg_sync_room_occupancy_delete ON public.students;
CREATE TRIGGER trg_sync_room_occupancy_delete
  AFTER DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.sync_room_occupancy();

-- -----------------------------------------------------------------------------
-- 3. Complete policy replacement for all seven tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Remove every policy defined by the current schema before creating the final
-- set. These are the exact names listed in the inventory above.
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;

DROP POLICY IF EXISTS "hostels_select_authenticated" ON public.hostels;
DROP POLICY IF EXISTS "hostels_insert_admin" ON public.hostels;
DROP POLICY IF EXISTS "hostels_update_admin_or_warden" ON public.hostels;
DROP POLICY IF EXISTS "hostels_delete_admin" ON public.hostels;
DROP POLICY IF EXISTS "hostels_select_scoped" ON public.hostels;

DROP POLICY IF EXISTS "rooms_select_authenticated" ON public.rooms;
DROP POLICY IF EXISTS "rooms_insert_admin_or_warden" ON public.rooms;
DROP POLICY IF EXISTS "rooms_update_admin_or_warden" ON public.rooms;
DROP POLICY IF EXISTS "rooms_delete_admin" ON public.rooms;
DROP POLICY IF EXISTS "rooms_select_scoped" ON public.rooms;

DROP POLICY IF EXISTS "students_select_authenticated" ON public.students;
DROP POLICY IF EXISTS "students_insert_admin" ON public.students;
DROP POLICY IF EXISTS "students_update_admin_warden_or_self" ON public.students;
DROP POLICY IF EXISTS "students_delete_admin" ON public.students;
DROP POLICY IF EXISTS "students_select_scoped" ON public.students;

DROP POLICY IF EXISTS "complaints_select" ON public.complaints;
DROP POLICY IF EXISTS "complaints_insert" ON public.complaints;
DROP POLICY IF EXISTS "complaints_update" ON public.complaints;
DROP POLICY IF EXISTS "complaints_delete" ON public.complaints;

DROP POLICY IF EXISTS "leave_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_insert_student" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_update_status" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_delete" ON public.leave_requests;

DROP POLICY IF EXISTS "notices_select_all" ON public.notices;
DROP POLICY IF EXISTS "notices_insert_admin_or_warden" ON public.notices;
DROP POLICY IF EXISTS "notices_update_admin_or_warden" ON public.notices;
DROP POLICY IF EXISTS "notices_delete_admin_or_warden" ON public.notices;

-- Profiles: own profile, assigned-hostel students for wardens, all for admins.
CREATE POLICY "profiles_select_scoped"
  ON public.profiles FOR SELECT TO authenticated
  USING (private.can_view_profile(id));

CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR private.is_admin())
  WITH CHECK (auth.uid() = id OR private.is_admin());

CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

-- Hostels: admins see all; wardens/students see only their assigned hostel.
CREATE POLICY "hostels_select_scoped"
  ON public.hostels FOR SELECT TO authenticated
  USING (private.is_admin() OR private.is_warden_for_hostel(id) OR private.is_student_for_hostel(id));

CREATE POLICY "hostels_insert_admin"
  ON public.hostels FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "hostels_update_admin_or_warden"
  ON public.hostels FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "hostels_delete_admin"
  ON public.hostels FOR DELETE TO authenticated
  USING (private.is_admin());

-- Rooms: admins, assigned wardens, and students in the hostel can read.
CREATE POLICY "rooms_select_scoped"
  ON public.rooms FOR SELECT TO authenticated
  USING (private.is_admin() OR private.is_warden_for_hostel(hostel_id) OR private.is_student_for_hostel(hostel_id));

CREATE POLICY "rooms_insert_admin_or_warden"
  ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (private.is_warden_for_hostel(hostel_id));

CREATE POLICY "rooms_update_admin_or_warden"
  ON public.rooms FOR UPDATE TO authenticated
  USING (private.is_warden_for_hostel(hostel_id))
  WITH CHECK (private.is_warden_for_hostel(hostel_id));

CREATE POLICY "rooms_delete_admin"
  ON public.rooms FOR DELETE TO authenticated
  USING (private.is_admin());

-- Students: students see only themselves; wardens see their assigned hostel;
-- admins see all. Roommates are not exposed by this policy.
CREATE POLICY "students_select_scoped"
  ON public.students FOR SELECT TO authenticated
  USING (private.is_admin() OR private.is_warden_for_hostel(hostel_id) OR user_id = auth.uid());

CREATE POLICY "students_insert_admin"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "students_update_admin_warden_or_self"
  ON public.students FOR UPDATE TO authenticated
  USING (private.is_admin() OR private.is_warden_for_hostel(hostel_id) OR user_id = auth.uid())
  WITH CHECK (
    private.is_admin()
    OR private.is_warden_for_hostel(hostel_id)
    OR (
      user_id = auth.uid()
      AND room_id IS NOT DISTINCT FROM private.get_student_room_id(students.id)
      AND hostel_id IS NOT DISTINCT FROM private.get_student_hostel_id(students.id)
    )
  );

CREATE POLICY "students_delete_admin"
  ON public.students FOR DELETE TO authenticated
  USING (private.is_admin());

-- Complaints: global for admins, assigned-hostel for wardens, own for students.
CREATE POLICY "complaints_select_scoped"
  ON public.complaints FOR SELECT TO authenticated
  USING (private.can_access_student_record(student_id));

CREATE POLICY "complaints_insert_scoped"
  ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    OR (
      student_id = private.get_current_student_id()
      AND (room_id IS NULL OR room_id = private.get_student_room_id(student_id))
    )
  );

CREATE POLICY "complaints_update_scoped"
  ON public.complaints FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR private.is_warden_for_student(student_id)
    OR (student_id = private.get_current_student_id() AND status = 'pending')
  )
  WITH CHECK (
    private.is_admin()
    OR private.is_warden_for_student(student_id)
    OR (student_id = private.get_current_student_id() AND status = 'pending')
  );

CREATE POLICY "complaints_delete_scoped"
  ON public.complaints FOR DELETE TO authenticated
  USING (private.is_admin() OR (student_id = private.get_current_student_id() AND status = 'pending'));

-- Leave: global for admins, assigned-hostel for wardens, own for students.
-- Students may insert/delete pending requests but cannot update approval fields.
CREATE POLICY "leave_select_scoped"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (private.can_access_student_record(student_id));

CREATE POLICY "leave_insert_scoped"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (private.is_admin() OR student_id = private.get_current_student_id());

CREATE POLICY "leave_update_scoped"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR private.is_warden_for_student(student_id)
    OR (student_id = private.get_current_student_id() AND status = 'pending')
  )
  WITH CHECK (
    private.is_admin()
    OR private.is_warden_for_student(student_id)
    OR (student_id = private.get_current_student_id() AND status = 'pending')
  );

CREATE POLICY "leave_delete_scoped"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (private.is_admin() OR (student_id = private.get_current_student_id() AND status = 'pending'));

-- Notices: global notices are visible to every authenticated user. Hostel-
-- specific notices are visible only to admins, the assigned warden, or students
-- assigned to that hostel. Only admins may create/update/delete global notices;
-- wardens may manage notices for their assigned hostel only.
CREATE POLICY "notices_select_scoped"
  ON public.notices FOR SELECT TO authenticated
  USING (
    hostel_id IS NULL
    OR private.is_admin()
    OR private.is_warden_for_hostel(hostel_id)
    OR private.is_student_for_hostel(hostel_id)
  );

CREATE POLICY "notices_insert_scoped"
  ON public.notices FOR INSERT TO authenticated
  WITH CHECK (
    posted_by = auth.uid()
    AND (private.is_admin() OR private.is_warden())
    AND (private.is_admin() OR (hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id)))
  );

CREATE POLICY "notices_update_scoped"
  ON public.notices FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (posted_by = auth.uid() AND hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id))
  )
  WITH CHECK (
    private.is_admin()
    OR (posted_by = auth.uid() AND hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id))
  );

CREATE POLICY "notices_delete_scoped"
  ON public.notices FOR DELETE TO authenticated
  USING (
    private.is_admin()
    OR (posted_by = auth.uid() AND hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id))
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- 4. Post-application verification matrix (run separately)
-- -----------------------------------------------------------------------------
-- Required accounts:
-- A = admin; W1 = warden assigned only to hostel H1; W2 = warden assigned only
-- to hostel H2; S1 = student in H1; S2 = student in H2.
-- Do not use the service-role key in the browser. Use separate authenticated
-- sessions and read-only/direct-operation attempts through the anon/publishable
-- key where appropriate.
--
-- Function/RPC tests:
-- - anon cannot execute any private helper or trigger-only function.
-- - authenticated policy evaluation succeeds; direct private RPC is unavailable
--   unless private was mistakenly exposed through PostgREST, which is a blocker.
-- - signup metadata role='admin' or role='warden' creates a student profile.
-- - only a trusted admin/bootstrap operation can promote a profile.
--
-- Visibility tests:
-- - A sees all seven tables allowed by policy.
-- - W1 sees H1 students/rooms/complaints/leave/hostel notices, not H2 records.
-- - W2 sees H2 records, not H1 records.
-- - S1 sees only S1's student/profile/complaints/leave and H1 room/hostel data.
-- - S2 sees only S2's student/profile/complaints/leave and H2 room/hostel data.
-- - All five authenticated accounts see global notices.
-- - Only A/W1/S1 see an H1-specific notice; only A/W2/S2 see an H2-specific notice.
--
-- Allocation tests:
-- - A allocates students to a room; the target room row is locked during the
--   capacity check, so two concurrent allocations cannot exceed capacity.
-- - W1 may manage H1 rooms, not H2 rooms; W2 is the inverse.
-- - A room allocation derives students.hostel_id from rooms.hostel_id.
-- - Setting students.room_id NULL also sets students.hostel_id NULL and the old
--   room occupancy/status is recalculated.
-- - A capacity reduction below current occupants fails without changing data.
-- - current_occupants/status remain derived from students, except maintenance is
--   preserved.
--
-- Complaint tests:
-- - S1/S2 can insert only their own complaint and cannot forge another student_id
--   or another student's room_id.
-- - W1/W2 can update statuses only for complaints in their assigned hostel.
-- - Students can edit pending complaint fields only while status remains pending;
--   they cannot resolve their own complaint.
-- - Complaint student_id cannot be reassigned by non-admin users.
--
-- Leave tests:
-- - S1/S2 can insert only their own request and delete only their own pending one.
-- - Students cannot approve/reject, set remarks, or forge approved_by.
-- - W1/W2 can approve/reject only requests for their assigned hostel.
-- - approved_by is set to auth.uid() for authenticated approvals/rejections;
--   client-supplied forged values are overwritten.
-- - Leave student_id cannot be reassigned by non-admin users.
--
-- After verification, rerun the application's read-only public.hostels query and
-- inspect the PostgREST schema cache. Keep application CRUD work paused until
-- these tests pass.
