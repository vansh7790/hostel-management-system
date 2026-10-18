-- HOSTEL MANAGEMENT SYSTEM
-- Fresh Supabase project initial setup
-- Date: 2026-10-18
--
-- REVIEW BEFORE EXECUTION.
-- This file is intended for a fresh Supabase project. It creates the seven
-- application tables, indexes, private RLS helpers, triggers, and RLS policies.
-- It contains no demo seed data, demo credentials, automatic admin creation,
-- destructive DROP statements, DELETE/UPDATE data repairs, or table resets.
--
-- Required manual Supabase configuration before running:
-- 1. Supabase Dashboard > Settings > API > Exposed schemas must include public
--    and must not include private.
-- 2. If pgrst.db_schemas is unavailable in SQL Editor, the script relies
--    on manual verification of Dashboard > Settings > API > Exposed schemas.
--    Ensure public is exposed and private is not exposed before execution.
-- 3. Run this script as the project database owner/SQL Editor role.
-- 4. Do not put a service-role key in browser code or VITE_ variables.
--
-- First admin bootstrap, after a user signs up:
-- 1. Create a normal Auth user through Supabase Auth. The trigger below creates
--    that user's profile as student regardless of signup metadata.
-- 2. In the trusted Supabase SQL Editor, inspect the exact Auth user UUID:
--      SELECT id, email, role FROM public.profiles WHERE email = 'admin@example.com';
-- 3. After confirming the identity, promote only that profile explicitly:
--      UPDATE public.profiles
--      SET role = 'admin', updated_at = NOW()
--      WHERE id = '<confirmed-auth-user-uuid>' AND role = 'student';
--    This is the only intended initial admin bootstrap path. Do not expose it
--    as a client RPC and do not run it with an unconfirmed UUID.
-- 4. Create warden accounts normally, then have an authenticated admin assign
--    their profile UUID to hostels through the application workflow later.
--
-- This file is unapplied. Static review only; it has not been executed or tested against PostgreSQL here.
-- Compatibility assumption: the application authenticates by email, so Auth
-- users used by this frontend must have an email address.

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Fail-safe preconditions
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_exposed_schemas TEXT;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Supabase auth.users is unavailable; run this in a Supabase project.';
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL
    OR to_regclass('public.hostels') IS NOT NULL
    OR to_regclass('public.rooms') IS NOT NULL
    OR to_regclass('public.students') IS NOT NULL
    OR to_regclass('public.complaints') IS NOT NULL
    OR to_regclass('public.leave_requests') IS NOT NULL
    OR to_regclass('public.notices') IS NOT NULL THEN
    RAISE EXCEPTION 'One or more hostel application tables already exist; inspect the database and do not run fresh initial_setup.sql.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'private') THEN
    RAISE EXCEPTION 'Schema private already exists; inspect it before running fresh initial_setup.sql.';
  END IF;


  v_exposed_schemas := current_setting('pgrst.db_schemas', true);

  -- If the setting is unavailable in SQL Editor, rely on the manually
  -- verified Dashboard > Settings > API > Exposed schemas configuration.
  -- Confirm that public is exposed and private is NOT exposed before running.
  IF v_exposed_schemas IS NOT NULL AND btrim(v_exposed_schemas) <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(regexp_split_to_array(v_exposed_schemas, '\s*,\s*')) AS exposed(schema_name)
      WHERE btrim(exposed.schema_name) = 'private'
    ) THEN
      RAISE EXCEPTION 'Unsafe PostgREST configuration: private is exposed. Remove private from Dashboard > Settings > API > Exposed schemas.';
    END IF;
  ELSE
    RAISE NOTICE 'Could not read pgrst.db_schemas. Proceeding based on manual dashboard verification; ensure public is exposed and private is not.';
  END IF;

END;
$$;

CREATE SCHEMA private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'warden', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('boys', 'girls')),
  warden_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_rooms INTEGER NOT NULL DEFAULT 0 CHECK (total_rooms >= 0),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER NOT NULL DEFAULT 1,
  capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity > 0),
  current_occupants INTEGER NOT NULL DEFAULT 0 CHECK (current_occupants >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'full', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hostel_room UNIQUE (hostel_id, room_number),
  CONSTRAINT chk_room_occupants_capacity CHECK (current_occupants <= capacity)
);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  year INTEGER CHECK (year >= 1 AND year <= 5),
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE RESTRICT,
  guardian_name TEXT,
  guardian_phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('electrical', 'plumbing', 'cleaning', 'internet', 'furniture', 'other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  emergency_contact TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  remark TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_rooms_hostel_id ON public.rooms(hostel_id);
CREATE INDEX idx_students_user_id ON public.students(user_id);
CREATE INDEX idx_students_room_id ON public.students(room_id);
CREATE INDEX idx_students_hostel_id ON public.students(hostel_id);
CREATE INDEX idx_complaints_student_id ON public.complaints(student_id);
CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_leave_student_id ON public.leave_requests(student_id);
CREATE INDEX idx_leave_status ON public.leave_requests(status);
CREATE INDEX idx_notices_hostel_id ON public.notices(hostel_id);
CREATE INDEX idx_notices_created_at ON public.notices(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Private security helpers
-- -----------------------------------------------------------------------------
CREATE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE FUNCTION private.is_warden()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'warden'
  );
$$;

CREATE FUNCTION private.get_current_student_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid();
$$;

CREATE FUNCTION private.is_warden_for_hostel(p_hostel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT private.is_admin()
    OR (
      private.is_warden()
      AND EXISTS (
        SELECT 1 FROM public.hostels
        WHERE id = p_hostel_id AND warden_id = auth.uid()
      )
    );
$$;

CREATE FUNCTION private.is_student_for_hostel(p_hostel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE user_id = auth.uid() AND hostel_id = p_hostel_id
  );
$$;

CREATE FUNCTION private.get_student_room_id(p_student_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT room_id FROM public.students WHERE id = p_student_id;
$$;

CREATE FUNCTION private.get_student_hostel_id(p_student_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT hostel_id FROM public.students WHERE id = p_student_id;
$$;

CREATE FUNCTION private.is_warden_for_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT private.is_warden_for_hostel(private.get_student_hostel_id(p_student_id));
$$;

CREATE FUNCTION private.can_access_student_record(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT private.is_admin()
    OR p_student_id = private.get_current_student_id()
    OR private.is_warden_for_student(p_student_id);
$$;

CREATE FUNCTION private.can_view_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() = p_profile_id
    OR private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.hostels h
      JOIN public.students s ON s.hostel_id = h.id AND s.user_id = p_profile_id
      WHERE h.warden_id = auth.uid() AND private.is_warden()
    );
$$;

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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon;

-- -----------------------------------------------------------------------------
-- 4. Trigger functions
-- -----------------------------------------------------------------------------
CREATE FUNCTION private.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'New user'),
    NEW.email,
    'student'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: Cannot modify user role.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.prevent_student_identity_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.is_admin()
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
    RAISE EXCEPTION 'Permission denied: Student identity fields cannot be reassigned.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.prevent_student_self_allocation_changes()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.is_admin()
     AND NOT private.is_warden_for_hostel(OLD.hostel_id)
     AND (NEW.room_id IS DISTINCT FROM OLD.room_id
          OR NEW.hostel_id IS DISTINCT FROM OLD.hostel_id) THEN
    RAISE EXCEPTION 'Permission denied: Students cannot change their own hostel or room allocation.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.prevent_request_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.is_admin()
     AND NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Permission denied: Request ownership cannot be reassigned.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.enforce_complaint_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_room_id UUID;
  v_student_hostel_id UUID;
BEGIN
  SELECT room_id, hostel_id INTO v_student_room_id, v_student_hostel_id
  FROM public.students
  WHERE id = NEW.student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint student does not exist.';
  END IF;

  IF NEW.room_id IS DISTINCT FROM v_student_room_id THEN
    -- A room deletion may set historical complaint.room_id to NULL. Permit
    -- that FK action only when no student is currently allocated to that room.
    IF NOT (TG_OP = 'UPDATE' AND OLD.room_id IS NOT NULL AND NEW.room_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.students WHERE room_id = OLD.room_id)) THEN
      RAISE EXCEPTION 'Complaint room must match the student current room.';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT private.is_admin()
     AND NEW.student_id <> private.get_current_student_id()
     AND NOT private.is_warden_for_hostel(v_student_hostel_id) THEN
    RAISE EXCEPTION 'Permission denied: Complaint is outside your hostel scope.';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT private.is_admin() AND TG_OP = 'UPDATE'
     AND (NEW.room_id IS DISTINCT FROM OLD.room_id
          OR NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
    RAISE EXCEPTION 'Permission denied: Complaint ownership or room cannot be reassigned.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION private.set_notice_author()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.posted_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.enforce_leave_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    IF NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.destination IS DISTINCT FROM OLD.destination
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.emergency_contact IS DISTINCT FROM OLD.emergency_contact
       OR NEW.message IS DISTINCT FROM OLD.message THEN
      RAISE EXCEPTION 'Permission denied: Wardens may change only leave status and approval remark.';
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
$$;

CREATE FUNCTION private.normalize_room_occupancy()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_occupants INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_occupants FROM public.students WHERE room_id = NEW.id;

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
$$;

CREATE FUNCTION private.check_student_room_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room_capacity INTEGER;
  v_room_hostel_id UUID;
  v_current_count INTEGER;
BEGIN
  -- Lock affected room rows in a stable order to serialize concurrent
  -- allocations and avoid the common old-room/new-room lock-order deadlock.
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

  SELECT capacity, hostel_id INTO v_room_capacity, v_room_hostel_id
  FROM public.rooms WHERE id = NEW.room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target room does not exist.';
  END IF;

  NEW.hostel_id := v_room_hostel_id;

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

CREATE FUNCTION private.sync_room_occupancy()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.room_id IS NOT NULL
     OR TG_OP = 'DELETE' AND OLD.room_id IS NOT NULL THEN
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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger functions are invoked by PostgreSQL triggers, not browser RPC calls.
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_student_identity_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_student_self_allocation_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_request_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_complaint_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_notice_author() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_leave_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.normalize_room_occupancy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.check_student_room_allocation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_room_occupancy() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.prevent_profile_role_escalation();

CREATE TRIGGER trg_prevent_student_identity_reassignment
  BEFORE UPDATE OF user_id, student_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.prevent_student_identity_reassignment();

CREATE TRIGGER trg_prevent_student_self_allocation_changes
  BEFORE UPDATE OF room_id, hostel_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.prevent_student_self_allocation_changes();

CREATE TRIGGER trg_enforce_complaint_integrity_insert
  BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION private.enforce_complaint_integrity();

CREATE TRIGGER trg_enforce_complaint_integrity_update
  BEFORE UPDATE OF student_id, room_id ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION private.enforce_complaint_integrity();

CREATE TRIGGER trg_prevent_leave_reassignment
  BEFORE UPDATE OF student_id ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION private.prevent_request_reassignment();

CREATE TRIGGER trg_set_notice_author
  BEFORE INSERT ON public.notices
  FOR EACH ROW EXECUTE FUNCTION private.set_notice_author();

CREATE TRIGGER trg_enforce_leave_workflow_insert
  BEFORE INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION private.enforce_leave_workflow();

CREATE TRIGGER trg_enforce_leave_workflow_update
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION private.enforce_leave_workflow();

CREATE TRIGGER trg_normalize_room_occupancy_insert
  BEFORE INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION private.normalize_room_occupancy();

CREATE TRIGGER trg_normalize_room_occupancy_update
  BEFORE UPDATE OF capacity, current_occupants, status ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION private.normalize_room_occupancy();

CREATE TRIGGER trg_validate_student_room_insert
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.check_student_room_allocation();

CREATE TRIGGER trg_validate_student_room_update
  BEFORE UPDATE OF room_id, hostel_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.check_student_room_allocation();

CREATE TRIGGER trg_sync_room_occupancy_insert
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.sync_room_occupancy();

CREATE TRIGGER trg_sync_room_occupancy_update
  AFTER UPDATE OF room_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.sync_room_occupancy();

CREATE TRIGGER trg_sync_room_occupancy_delete
  AFTER DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.sync_room_occupancy();

-- -----------------------------------------------------------------------------
-- 6. RLS policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Profiles: own profile, assigned-hostel students for wardens, all for admins.
CREATE POLICY profiles_select_scoped
  ON public.profiles FOR SELECT TO authenticated
  USING (private.can_view_profile(id));

CREATE POLICY profiles_update_own_or_admin
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR private.is_admin())
  WITH CHECK (auth.uid() = id OR private.is_admin());

-- Profiles are created by the auth trigger. Client profile insertion is denied.
CREATE POLICY profiles_insert_admin
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

-- Hostels: students/wardens see assigned hostel; admins manage metadata.
CREATE POLICY hostels_select_scoped
  ON public.hostels FOR SELECT TO authenticated
  USING (private.is_admin() OR private.is_warden_for_hostel(id) OR private.is_student_for_hostel(id));

CREATE POLICY hostels_insert_admin
  ON public.hostels FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY hostels_update_admin
  ON public.hostels FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY hostels_delete_admin
  ON public.hostels FOR DELETE TO authenticated
  USING (private.is_admin());

-- Rooms: admins and assigned wardens manage; assigned students can read.
CREATE POLICY rooms_select_scoped
  ON public.rooms FOR SELECT TO authenticated
  USING (private.is_admin() OR private.is_warden_for_hostel(hostel_id) OR private.is_student_for_hostel(hostel_id));

CREATE POLICY rooms_insert_admin_or_warden
  ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (private.is_warden_for_hostel(hostel_id));

CREATE POLICY rooms_update_admin_or_warden
  ON public.rooms FOR UPDATE TO authenticated
  USING (private.is_warden_for_hostel(hostel_id))
  WITH CHECK (private.is_warden_for_hostel(hostel_id));

CREATE POLICY rooms_delete_admin
  ON public.rooms FOR DELETE TO authenticated
  USING (private.is_admin());

-- Students: students see only themselves; wardens see assigned-hostel students.
CREATE POLICY students_select_scoped
  ON public.students FOR SELECT TO authenticated
  USING (private.is_admin() OR private.is_warden_for_hostel(hostel_id) OR user_id = auth.uid());

CREATE POLICY students_insert_admin
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY students_update_admin_warden_or_self
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

CREATE POLICY students_delete_admin
  ON public.students FOR DELETE TO authenticated
  USING (private.is_admin());

-- Complaints: own for students, assigned-hostel for wardens, all for admins.
CREATE POLICY complaints_select_scoped
  ON public.complaints FOR SELECT TO authenticated
  USING (private.can_access_student_record(student_id));

CREATE POLICY complaints_insert_scoped
  ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    OR (
      student_id = private.get_current_student_id()
      AND room_id IS NOT DISTINCT FROM private.get_student_room_id(student_id)
    )
  );

CREATE POLICY complaints_update_scoped
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

CREATE POLICY complaints_delete_scoped
  ON public.complaints FOR DELETE TO authenticated
  USING (private.is_admin() OR (student_id = private.get_current_student_id() AND status = 'pending'));

-- Leave: students own requests; assigned wardens/admins review requests.
CREATE POLICY leave_select_scoped
  ON public.leave_requests FOR SELECT TO authenticated
  USING (private.can_access_student_record(student_id));

CREATE POLICY leave_insert_scoped
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (private.is_admin() OR student_id = private.get_current_student_id());

CREATE POLICY leave_update_scoped
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

CREATE POLICY leave_delete_scoped
  ON public.leave_requests FOR DELETE TO authenticated
  USING (private.is_admin() OR (student_id = private.get_current_student_id() AND status = 'pending'));

-- Global notices are readable by authenticated users. Hostel-specific notices
-- are restricted to admins, the assigned warden, or hostel residents.
CREATE POLICY notices_select_scoped
  ON public.notices FOR SELECT TO authenticated
  USING (
    hostel_id IS NULL
    OR private.is_admin()
    OR private.is_warden_for_hostel(hostel_id)
    OR private.is_student_for_hostel(hostel_id)
  );

CREATE POLICY notices_insert_scoped
  ON public.notices FOR INSERT TO authenticated
  WITH CHECK (
    posted_by = auth.uid()
    AND (private.is_admin() OR private.is_warden())
    AND (private.is_admin() OR (hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id)))
  );

CREATE POLICY notices_update_scoped
  ON public.notices FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (posted_by = auth.uid() AND hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id))
  )
  WITH CHECK (
    private.is_admin()
    OR (posted_by = auth.uid() AND hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id))
  );

CREATE POLICY notices_delete_scoped
  ON public.notices FOR DELETE TO authenticated
  USING (
    private.is_admin()
    OR (posted_by = auth.uid() AND hostel_id IS NOT NULL AND private.is_warden_for_hostel(hostel_id))
  );

-- Explicit table privileges: authenticated users reach data only through RLS.
-- Anonymous browser access is intentionally disabled for all application tables.
REVOKE ALL ON TABLE
  public.profiles,
  public.hostels,
  public.rooms,
  public.students,
  public.complaints,
  public.leave_requests,
  public.notices
FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.hostels,
  public.rooms,
  public.students,
  public.complaints,
  public.leave_requests,
  public.notices
TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- 7. Post-setup verification checklist
-- -----------------------------------------------------------------------------
-- Run separately after setup, using controlled accounts:
-- - Confirm all seven tables, policies, functions, and triggers exist.
-- - Confirm private is absent from Dashboard > Settings > API > Exposed schemas.
-- - Confirm signup metadata role cannot create admin/warden profiles.
-- - Promote the first admin only through the trusted SQL Editor operation above.
-- - Assign a warden to one hostel through the admin workflow and test boundaries.
-- - Test student complaint ownership and room association.
-- - Test pending-to-approved/rejected leave transitions and approved_by.
-- - Test concurrent room allocation and room unallocation.
-- - Test global and hostel-specific notice visibility.
-- - Inspect errors and RLS behavior before connecting application CRUD pages.
