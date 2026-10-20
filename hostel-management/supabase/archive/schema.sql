-- ==============================================================================
-- HOSTEL MANAGEMENT SYSTEM - COMPLETE SUPABASE POSTGRESQL SCHEMA
-- Core Tables: profiles, hostels, rooms, students, complaints, leave_requests, notices
-- Security: Row Level Security (RLS) with non-recursive SECURITY DEFINER helpers
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE (Linked directly to auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'warden', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. HOSTELS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('boys', 'girls')),
  warden_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_rooms INTEGER NOT NULL DEFAULT 0 CHECK (total_rooms >= 0),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. ROOMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER NOT NULL DEFAULT 1,
  capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity > 0),
  current_occupants INTEGER NOT NULL DEFAULT 0 CHECK (current_occupants >= 0 AND current_occupants <= capacity),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'full', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_hostel_room UNIQUE (hostel_id, room_number)
);

-- ==============================================================================
-- 4. STUDENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  year INTEGER CHECK (year >= 1 AND year <= 5),
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  guardian_name TEXT,
  guardian_phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. COMPLAINTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('electrical', 'plumbing', 'cleaning', 'internet', 'furniture', 'other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. LEAVE REQUESTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

-- ==============================================================================
-- 7. NOTICES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON public.rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_room_id ON public.students(room_id);
CREATE INDEX IF NOT EXISTS idx_students_hostel_id ON public.students(hostel_id);
CREATE INDEX IF NOT EXISTS idx_complaints_student_id ON public.complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_leave_student_id ON public.leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_notices_hostel_id ON public.notices(hostel_id);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);

-- ==============================================================================
-- 9. CAPACITY AND ALLOCATION INTEGRITY TRIGGERS
-- ==============================================================================

-- Trigger Function: Validate student allocation & room capacity
CREATE OR REPLACE FUNCTION public.check_student_room_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_room_capacity INTEGER;
  v_room_hostel_id UUID;
  v_current_count INTEGER;
BEGIN
  -- If student is being assigned to a room
  IF NEW.room_id IS NOT NULL THEN
    -- Fetch target room info
    SELECT capacity, hostel_id INTO v_room_capacity, v_room_hostel_id
    FROM public.rooms
    WHERE id = NEW.room_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target room does not exist.';
    END IF;

    -- Automatically synchronize student.hostel_id with the room's hostel_id to prevent mismatch
    NEW.hostel_id := v_room_hostel_id;

    -- Count active occupants excluding the student themselves
    SELECT COUNT(*) INTO v_current_count
    FROM public.students
    WHERE room_id = NEW.room_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

    -- Check if assigning exceeds room capacity
    IF (v_current_count + 1) > v_room_capacity THEN
      RAISE EXCEPTION 'Room allocation failed: Room capacity (%) would be exceeded.', v_room_capacity;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_student_room ON public.students;
CREATE TRIGGER trg_validate_student_room
  BEFORE INSERT OR UPDATE OF room_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.check_student_room_allocation();

-- Trigger Function: Keep room current_occupants and status synchronized automatically
CREATE OR REPLACE FUNCTION public.sync_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  -- If old room existed, update its occupancy
  IF (TG_OP = 'UPDATE' AND OLD.room_id IS NOT NULL) OR (TG_OP = 'DELETE' AND OLD.room_id IS NOT NULL) THEN
    UPDATE public.rooms
    SET
      current_occupants = (SELECT COUNT(*) FROM public.students WHERE room_id = OLD.room_id),
      status = CASE
        WHEN status = 'maintenance' THEN 'maintenance'
        WHEN (SELECT COUNT(*) FROM public.students WHERE room_id = OLD.room_id) >= capacity THEN 'full'
        ELSE 'available'
      END,
      updated_at = NOW()
    WHERE id = OLD.room_id;
  END IF;

  -- If new room is assigned, update its occupancy
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.room_id IS NOT NULL THEN
    UPDATE public.rooms
    SET
      current_occupants = (SELECT COUNT(*) FROM public.students WHERE room_id = NEW.room_id),
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_room_occupancy ON public.students;
CREATE TRIGGER trg_sync_room_occupancy
  AFTER INSERT OR UPDATE OF room_id OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_occupancy();

-- ==============================================================================
-- 10. AUTH TRIGGER (Auto-create profile from auth.users)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent users from escalating their own role in public.profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Check if executing user is an admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Permission denied: Cannot modify user role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ==============================================================================
-- 11. SECURITY DEFINER HELPER FUNCTIONS FOR NON-RECURSIVE RLS
-- ==============================================================================

-- Get authenticated user's role without recursion
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Check if current authenticated user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Check if current authenticated user is Warden
CREATE OR REPLACE FUNCTION public.is_warden()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'warden'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Get student record id corresponding to current authenticated user
CREATE OR REPLACE FUNCTION public.get_current_student_id()
RETURNS UUID AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Check if current authenticated user is Warden for a specific hostel
CREATE OR REPLACE FUNCTION public.is_warden_for_hostel(p_hostel_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.hostels WHERE id = p_hostel_id AND warden_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 12.1 PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 12.2 HOSTELS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "hostels_select_authenticated" ON public.hostels;
CREATE POLICY "hostels_select_authenticated"
  ON public.hostels FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "hostels_insert_admin" ON public.hostels;
CREATE POLICY "hostels_insert_admin"
  ON public.hostels FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "hostels_update_admin_or_warden" ON public.hostels;
CREATE POLICY "hostels_update_admin_or_warden"
  ON public.hostels FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR warden_id = auth.uid())
  WITH CHECK (public.is_admin() OR warden_id = auth.uid());

DROP POLICY IF EXISTS "hostels_delete_admin" ON public.hostels;
CREATE POLICY "hostels_delete_admin"
  ON public.hostels FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12.3 ROOMS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "rooms_select_authenticated" ON public.rooms;
CREATE POLICY "rooms_select_authenticated"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rooms_insert_admin_or_warden" ON public.rooms;
CREATE POLICY "rooms_insert_admin_or_warden"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_warden_for_hostel(hostel_id));

DROP POLICY IF EXISTS "rooms_update_admin_or_warden" ON public.rooms;
CREATE POLICY "rooms_update_admin_or_warden"
  ON public.rooms FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_warden_for_hostel(hostel_id))
  WITH CHECK (public.is_admin() OR public.is_warden_for_hostel(hostel_id));

DROP POLICY IF EXISTS "rooms_delete_admin" ON public.rooms;
CREATE POLICY "rooms_delete_admin"
  ON public.rooms FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12.4 STUDENTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "students_select_authenticated" ON public.students;
CREATE POLICY "students_select_authenticated"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_warden() OR
    user_id = auth.uid() OR
    -- Can view roommates sharing the exact same room
    (room_id IS NOT NULL AND room_id = (SELECT room_id FROM public.students WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "students_insert_admin" ON public.students;
CREATE POLICY "students_insert_admin"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "students_update_admin_warden_or_self" ON public.students;
CREATE POLICY "students_update_admin_warden_or_self"
  ON public.students FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_warden_for_hostel(hostel_id) OR
    user_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin() OR
    public.is_warden_for_hostel(hostel_id) OR
    -- If student is updating themselves, ensure they do not reallocate their own room or user_id
    (user_id = auth.uid() AND room_id IS NOT DISTINCT FROM (SELECT room_id FROM public.students WHERE id = students.id))
  );

DROP POLICY IF EXISTS "students_delete_admin" ON public.students;
CREATE POLICY "students_delete_admin"
  ON public.students FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12.5 COMPLAINTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "complaints_select" ON public.complaints;
CREATE POLICY "complaints_select"
  ON public.complaints FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_warden() OR
    student_id = public.get_current_student_id()
  );

DROP POLICY IF EXISTS "complaints_insert" ON public.complaints;
CREATE POLICY "complaints_insert"
  ON public.complaints FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    student_id = public.get_current_student_id()
  );

DROP POLICY IF EXISTS "complaints_update" ON public.complaints;
CREATE POLICY "complaints_update"
  ON public.complaints FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_warden() OR
    (student_id = public.get_current_student_id() AND status = 'pending')
  )
  WITH CHECK (
    public.is_admin() OR
    public.is_warden() OR
    (student_id = public.get_current_student_id() AND status = 'pending')
  );

DROP POLICY IF EXISTS "complaints_delete" ON public.complaints;
CREATE POLICY "complaints_delete"
  ON public.complaints FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR
    (student_id = public.get_current_student_id() AND status = 'pending')
  );

-- ------------------------------------------------------------------------------
-- 12.6 LEAVE REQUESTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "leave_select" ON public.leave_requests;
CREATE POLICY "leave_select"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_warden() OR
    student_id = public.get_current_student_id()
  );

DROP POLICY IF EXISTS "leave_insert_student" ON public.leave_requests;
CREATE POLICY "leave_insert_student"
  ON public.leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    student_id = public.get_current_student_id()
  );

DROP POLICY IF EXISTS "leave_update_status" ON public.leave_requests;
CREATE POLICY "leave_update_status"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_warden() OR
    (student_id = public.get_current_student_id() AND status = 'pending')
  )
  WITH CHECK (
    public.is_admin() OR
    public.is_warden() OR
    (student_id = public.get_current_student_id() AND status = 'pending')
  );

DROP POLICY IF EXISTS "leave_delete" ON public.leave_requests;
CREATE POLICY "leave_delete"
  ON public.leave_requests FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR
    (student_id = public.get_current_student_id() AND status = 'pending')
  );

-- ------------------------------------------------------------------------------
-- 12.7 NOTICES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "notices_select_all" ON public.notices;
CREATE POLICY "notices_select_all"
  ON public.notices FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "notices_insert_admin_or_warden" ON public.notices;
CREATE POLICY "notices_insert_admin_or_warden"
  ON public.notices FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_warden());

DROP POLICY IF EXISTS "notices_update_admin_or_warden" ON public.notices;
CREATE POLICY "notices_update_admin_or_warden"
  ON public.notices FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR posted_by = auth.uid())
  WITH CHECK (public.is_admin() OR posted_by = auth.uid());

DROP POLICY IF EXISTS "notices_delete_admin_or_warden" ON public.notices;
CREATE POLICY "notices_delete_admin_or_warden"
  ON public.notices FOR DELETE
  TO authenticated
  USING (public.is_admin() OR posted_by = auth.uid());

-- ==============================================================================
-- 13. SEED INITIAL HOSTEL INFRASTRUCTURE & DEMO PROFILES
-- ==============================================================================
-- This block can safely be executed after creating the 3 users in Supabase Auth:
-- 1) student@hostelhub.com (Password: your_password) -> Aarav Sharma
-- 2) warden@hostelhub.com  (Password: your_password) -> Dr. Singh
-- 3) admin@hostelhub.com   (Password: your_password) -> Admin User

INSERT INTO public.hostels (name, type, total_rooms, address)
VALUES
  ('Hostel Mandakini', 'boys', 64, 'North Campus, Sector 2'),
  ('Hostel Alakananda', 'boys', 60, 'North Campus, Sector 3'),
  ('Hostel Kaveri', 'girls', 68, 'South Campus, Block A'),
  ('Hostel Yamuna', 'girls', 60, 'South Campus, Block B')
ON CONFLICT (name) DO NOTHING;
