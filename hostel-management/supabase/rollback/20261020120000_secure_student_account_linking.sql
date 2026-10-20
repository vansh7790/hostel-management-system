-- Roll back 20261020120000_secure_student_account_linking.sql.
-- Existing students.user_id links are kept (they were verified when created).
-- The unique normalized-email index is kept because removing it would allow
-- ambiguous records; drop it separately only after review.
-- Run as postgres in the SQL Editor.

BEGIN;

DROP TRIGGER IF EXISTS zz_link_verified_student_after_auth_insert ON auth.users;
DROP TRIGGER IF EXISTS zz_link_verified_student_after_auth_confirmation ON auth.users;
DROP TRIGGER IF EXISTS trg_link_student_record_after_insert ON public.students;
DROP TRIGGER IF EXISTS trg_link_student_record_after_email_update ON public.students;
DROP TRIGGER IF EXISTS trg_protect_profile_email ON public.profiles;
DROP TRIGGER IF EXISTS trg_restrict_student_self_update ON public.students;

-- Restore the baseline guard from initial_setup_review3.sql.
CREATE OR REPLACE FUNCTION private.prevent_student_identity_reassignment()
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
REVOKE ALL ON FUNCTION private.prevent_student_identity_reassignment() FROM PUBLIC, anon, authenticated;

-- Restore the baseline allocation validator (without the maintenance check).
CREATE OR REPLACE FUNCTION private.check_student_room_allocation()
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
REVOKE ALL ON FUNCTION private.check_student_room_allocation() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS private.handle_student_record_link();
DROP FUNCTION IF EXISTS private.protect_profile_email();
DROP FUNCTION IF EXISTS private.restrict_student_self_update();
DROP FUNCTION IF EXISTS private.handle_verified_student_auth_link();
DROP FUNCTION IF EXISTS private.link_verified_student_profile(uuid);
DROP FUNCTION IF EXISTS private.is_verified_student_identity_link(uuid, uuid);

COMMIT;
