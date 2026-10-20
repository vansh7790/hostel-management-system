-- DEV-ONLY dummy data for end-to-end testing. Fictional people only.
--
-- Prerequisites (dev project):
--   1. initial_setup_review3.sql, then migrations 20261018130000,
--      20261019120000, 20261020120000 (in that order).
--   2. 00_mark_dev_environment.sql (this file aborts without the marker).
--   3. Test logins created via create-test-accounts.mjs (recommended first, so
--      admin/warden roles and warden assignments are applied; re-running this
--      file later also fills them in).
--
-- Idempotent: re-running never duplicates rows. Existing rows are left as they
-- are (tester changes are preserved). To restore the original state, run
-- dev_seed_cleanup.sql and then this file again.
--
-- How test data is identified:
--   hostels  name LIKE '[TEST] %'           (rooms belong to these hostels)
--   students student_id LIKE 'TST26-%'      (complaints/leave belong to these)
--   accounts email LIKE '%@hostel-test.example'
--   notices  hostel_id in a test hostel, or posted_by a test account
--
-- Run as postgres in the dev project's SQL Editor.

BEGIN;

DO $guard$
BEGIN
  -- Separate checks: PL/pgSQL plans a whole IF expression, so the marker table
  -- may only be referenced after its existence is confirmed.
  IF pg_catalog.to_regclass('private.dev_environment') IS NULL THEN
    RAISE EXCEPTION 'Not a marked development project (private.dev_environment missing). Seed aborted; nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dev_environment) THEN
    RAISE EXCEPTION 'Not a marked development project (private.dev_environment is empty). Seed aborted; nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname = 'trg_link_student_record_after_insert' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Migration 20261020120000 is not applied in this project. Apply it before seeding.';
  END IF;
END;
$guard$;

-- ---------------------------------------------------------------------------
-- 1. Roles for the fictional staff logins (test domain only; never real users)
-- ---------------------------------------------------------------------------
UPDATE public.profiles SET role = 'admin', updated_at = now()
WHERE lower(email) = 'admin.test@hostel-test.example' AND role <> 'admin';

UPDATE public.profiles SET role = 'warden', updated_at = now()
WHERE lower(email) IN ('warden.aravali@hostel-test.example', 'warden.nilgiri@hostel-test.example', 'warden.shivalik@hostel-test.example')
  AND role <> 'warden';

-- ---------------------------------------------------------------------------
-- 2. Hostels (Shivalik is the deliberately empty hostel: rooms, no residents)
-- ---------------------------------------------------------------------------
INSERT INTO public.hostels (name, type, address) VALUES
  ('[TEST] Aravali House', 'boys', 'North Campus, Block A'),
  ('[TEST] Nilgiri House', 'girls', 'South Campus, Block N'),
  ('[TEST] Shivalik House', 'boys', 'East Campus, Block S')
ON CONFLICT (name) DO NOTHING;

UPDATE public.hostels AS h SET warden_id = p.id, updated_at = now()
FROM (VALUES
  ('[TEST] Aravali House', 'warden.aravali@hostel-test.example'),
  ('[TEST] Nilgiri House', 'warden.nilgiri@hostel-test.example'),
  ('[TEST] Shivalik House', 'warden.shivalik@hostel-test.example')
) AS v(hostel, warden_email)
JOIN public.profiles AS p ON lower(p.email) = v.warden_email AND p.role = 'warden'
WHERE h.name = v.hostel AND h.warden_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Rooms (15). Occupancy/status are computed by database triggers.
-- ---------------------------------------------------------------------------
INSERT INTO public.rooms (hostel_id, room_number, floor, capacity)
SELECT h.id, v.room_number, v.floor, v.capacity
FROM (VALUES
  ('[TEST] Aravali House', 'A-101', 1, 2),
  ('[TEST] Aravali House', 'A-102', 1, 2),
  ('[TEST] Aravali House', 'A-103', 1, 3),
  ('[TEST] Aravali House', 'A-104', 1, 1),
  ('[TEST] Aravali House', 'A-201', 2, 2),
  ('[TEST] Aravali House', 'A-202', 2, 3),
  ('[TEST] Aravali House', 'A-203', 2, 2),
  ('[TEST] Aravali House', 'A-204', 2, 1),
  ('[TEST] Nilgiri House', 'N-101', 1, 2),
  ('[TEST] Nilgiri House', 'N-102', 1, 3),
  ('[TEST] Nilgiri House', 'N-103', 1, 1),
  ('[TEST] Nilgiri House', 'N-201', 2, 2),
  ('[TEST] Nilgiri House', 'N-202', 2, 2),
  ('[TEST] Shivalik House', 'S-101', 1, 2),
  ('[TEST] Shivalik House', 'S-102', 1, 3)
) AS v(hostel, room_number, floor, capacity)
JOIN public.hostels AS h ON h.name = v.hostel
ON CONFLICT (hostel_id, room_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Students (20). room NULL = awaiting allocation in the intended hostel.
--    Allocation goes through the normal capacity/hostel triggers; the link
--    trigger connects records whose email + student ID match a confirmed login.
-- ---------------------------------------------------------------------------
INSERT INTO public.students (student_id, name, email, phone, department, year, intended_hostel_id, room_id, guardian_name, guardian_phone, address)
SELECT v.sid, v.name, v.email, v.phone, v.dept, v.yr, h.id, r.id, v.gname, v.gphone, v.addr
FROM (VALUES
  ('TST26-001', 'Aarav Mehta',      'aarav.mehta@hostel-test.example',      '+91 90000 10001', 'Computer Science',       2, '[TEST] Aravali House',  'A-101', 'Rakesh Mehta',     '+91 90000 20001', 'Jaipur, Rajasthan'),
  ('TST26-002', 'Kabir Singh',      'kabir.singh@hostel-test.example',      '+91 90000 10002', 'Mechanical Engineering', 3, '[TEST] Aravali House',  'A-101', 'Gurpreet Singh',   '+91 90000 20002', 'Ludhiana, Punjab'),
  ('TST26-003', 'Rohan Iyer',       'rohan.iyer@hostel-test.example',       '+91 90000 10003', 'Electronics',            1, '[TEST] Aravali House',  'A-102', 'Lakshmi Iyer',     '+91 90000 20003', 'Chennai, Tamil Nadu'),
  ('TST26-004', 'Arjun Nair',       'arjun.nair@hostel-test.example',       '+91 90000 10004', 'Computer Science',       4, '[TEST] Aravali House',  'A-103', 'Mohan Nair',       '+91 90000 20004', 'Kochi, Kerala'),
  ('TST26-005', 'Dev Malhotra',     'dev.malhotra@hostel-test.example',     '+91 90000 10005', 'Civil Engineering',      2, '[TEST] Aravali House',  'A-103', 'Anil Malhotra',    '+91 90000 20005', 'Delhi'),
  ('TST26-006', 'Ishaan Gupta',     'ishaan.gupta@hostel-test.example',     '+91 90000 10006', 'Electrical Engineering', 3, '[TEST] Aravali House',  'A-103', 'Sanjay Gupta',     '+91 90000 20006', 'Lucknow, Uttar Pradesh'),
  ('TST26-007', 'Vihaan Reddy',     'vihaan.reddy@hostel-test.example',     '+91 90000 10007', 'Information Technology', 1, '[TEST] Aravali House',  'A-104', 'Srinivas Reddy',   '+91 90000 20007', 'Hyderabad, Telangana'),
  ('TST26-008', 'Siddharth Joshi',  'siddharth.joshi@hostel-test.example',  '+91 90000 10008', 'Computer Science',       2, '[TEST] Aravali House',  'A-201', 'Prakash Joshi',    '+91 90000 20008', 'Pune, Maharashtra'),
  ('TST26-009', 'Ananya Sharma',    'ananya.sharma@hostel-test.example',    '+91 90000 10009', 'Computer Science',       3, '[TEST] Nilgiri House',  'N-101', 'Vinod Sharma',     '+91 90000 20009', 'Bhopal, Madhya Pradesh'),
  ('TST26-010', 'Diya Patel',       'diya.patel@hostel-test.example',       '+91 90000 10010', 'Electronics',            2, '[TEST] Nilgiri House',  'N-101', 'Hitesh Patel',     '+91 90000 20010', 'Ahmedabad, Gujarat'),
  ('TST26-011', 'Priya Menon',      'priya.menon@hostel-test.example',      '+91 90000 10011', 'Information Technology', 4, '[TEST] Nilgiri House',  'N-102', 'Ramesh Menon',     '+91 90000 20011', 'Thrissur, Kerala'),
  ('TST26-012', 'Kavya Rao',        'kavya.rao@hostel-test.example',        '+91 90000 10012', 'Civil Engineering',      2, '[TEST] Nilgiri House',  'N-102', 'Shankar Rao',      '+91 90000 20012', 'Mysuru, Karnataka'),
  ('TST26-013', 'Sneha Pillai',     'sneha.pillai@hostel-test.example',     '+91 90000 10013', 'Electrical Engineering', 3, '[TEST] Nilgiri House',  'N-103', 'Gopal Pillai',     '+91 90000 20013', 'Thiruvananthapuram, Kerala'),
  ('TST26-014', 'Riya Agarwal',     'riya.agarwal@hostel-test.example',     '+91 90000 10014', 'Computer Science',       1, '[TEST] Nilgiri House',  'N-201', 'Manoj Agarwal',    '+91 90000 20014', 'Kolkata, West Bengal'),
  ('TST26-015', 'Aditya Kulkarni',  'aditya.kulkarni@hostel-test.example',  '+91 90000 10015', 'Mechanical Engineering', 1, '[TEST] Aravali House',  NULL,    'Sunil Kulkarni',   '+91 90000 20015', 'Nagpur, Maharashtra'),
  ('TST26-016', 'Nikhil Bansal',    'nikhil.bansal@hostel-test.example',    '+91 90000 10016', 'Computer Science',       1, '[TEST] Aravali House',  NULL,    'Ashok Bansal',     '+91 90000 20016', 'Chandigarh'),
  ('TST26-017', 'Meera Joshi',      'meera.joshi@hostel-test.example',      '+91 90000 10017', 'Mechanical Engineering', 1, '[TEST] Nilgiri House',  NULL,    'Deepak Joshi',     '+91 90000 20017', 'Indore, Madhya Pradesh'),
  ('TST26-018', 'Tanvi Desai',      'tanvi.desai@hostel-test.example',      '+91 90000 10018', 'Computer Science',       1, '[TEST] Nilgiri House',  NULL,    'Kiran Desai',      '+91 90000 20018', 'Surat, Gujarat'),
  ('TST26-019', 'Harsh Vardhan',    'harsh.vardhan@hostel-test.example',    '+91 90000 10019', 'Computer Science',       1, '[TEST] Shivalik House', NULL,    'Rajiv Vardhan',    '+91 90000 20019', 'Dehradun, Uttarakhand'),
  ('TST26-020', 'Yash Chauhan',     'yash.chauhan@hostel-test.example',     '+91 90000 10020', 'Information Technology', 1, '[TEST] Aravali House',  NULL,    'Mahesh Chauhan',   '+91 90000 20020', 'Udaipur, Rajasthan')
) AS v(sid, name, email, phone, dept, yr, hostel, room, gname, gphone, addr)
JOIN public.hostels AS h ON h.name = v.hostel
LEFT JOIN public.rooms AS r ON r.hostel_id = h.id AND r.room_number = v.room
WHERE NOT EXISTS (
  SELECT 1 FROM public.students AS s
  WHERE s.student_id = v.sid OR lower(btrim(s.email)) = lower(btrim(v.email))
);

-- Edge case: an empty room under maintenance (set after allocation so the
-- maintenance check never blocks seeding).
UPDATE public.rooms AS r SET status = 'maintenance'
FROM public.hostels AS h
WHERE r.hostel_id = h.id AND h.name = '[TEST] Aravali House' AND r.room_number = 'A-203' AND r.status <> 'maintenance';

-- ---------------------------------------------------------------------------
-- 5. Complaints (12) — room_id must equal the student's current room
--    (enforced by the complaint integrity trigger).
-- ---------------------------------------------------------------------------
INSERT INTO public.complaints (student_id, room_id, title, category, description, status)
SELECT s.id, s.room_id, v.title, v.category, v.descr, v.status
FROM (VALUES
  ('TST26-001', 'Ceiling fan not working',        'electrical', 'The ceiling fan stopped working after the power cut on Monday.', 'resolved'),
  ('TST26-002', 'Bathroom tap leaking',           'plumbing',   'The tap in the attached bathroom drips constantly.',             'in_progress'),
  ('TST26-003', 'Wi-Fi drops every evening',      'internet',   'Connection drops between 8 PM and 11 PM almost daily.',          'pending'),
  ('TST26-004', 'Broken study chair',             'furniture',  'One leg of the study chair is cracked and unsafe.',              'pending'),
  ('TST26-005', 'Room not cleaned this week',     'cleaning',   'Housekeeping has not visited the room since last Thursday.',     'resolved'),
  ('TST26-007', 'Tube light flickering',          'electrical', 'The tube light flickers and makes a buzzing sound.',              'in_progress'),
  ('TST26-009', 'Wardrobe hinge broken',          'furniture',  'The left wardrobe door hinge has come loose.',                    'pending'),
  ('TST26-010', 'Low water pressure in shower',   'plumbing',   'Shower water pressure is very low in the mornings.',             'resolved'),
  ('TST26-011', 'LAN port not working',           'internet',   'The wall LAN port shows no link light.',                          'in_progress'),
  ('TST26-013', 'Window latch broken',            'other',      'The window latch does not close, letting rain in.',              'pending'),
  ('TST26-014', 'Corridor bins overflowing',      'cleaning',   'Second-floor corridor bins have not been emptied for two days.', 'pending'),
  ('TST26-015', 'Hostel ID card not issued',      'other',      'Awaiting room allocation; requesting a temporary hostel ID card.', 'pending')
) AS v(sid, title, category, descr, status)
JOIN public.students AS s ON s.student_id = v.sid
WHERE NOT EXISTS (SELECT 1 FROM public.complaints AS c WHERE c.student_id = s.id AND c.title = v.title);

-- ---------------------------------------------------------------------------
-- 6. Leave requests (9). Inserts are forced to 'pending' by the leave workflow
--    trigger, so decided requests are updated afterwards as trusted SQL, with
--    approved_by = the warden of the student's hostel.
-- ---------------------------------------------------------------------------
DO $leave$
DECLARE
  v record;
  v_student public.students%ROWTYPE;
  v_leave_id uuid;
  v_warden uuid;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    ('TST26-001', 'Family wedding',             'Jaipur, Rajasthan',      DATE '2026-11-06', DATE '2026-11-09', 'approved', 'Approved. Report back by 8 PM on return.'),
    ('TST26-003', 'Medical appointment',        'Chennai, Tamil Nadu',    DATE '2026-11-12', DATE '2026-11-13', 'pending',  NULL),
    ('TST26-004', 'Diwali home visit',          'Kochi, Kerala',          DATE '2026-11-07', DATE '2026-11-11', 'approved', 'Approved for the festival break.'),
    ('TST26-005', 'Inter-college hackathon',    'Bengaluru, Karnataka',   DATE '2026-11-14', DATE '2026-11-16', 'rejected', 'Clashes with internal assessments.'),
    ('TST26-008', 'Personal work',              'Pune, Maharashtra',      DATE '2026-11-20', DATE '2026-11-21', 'pending',  NULL),
    ('TST26-009', 'Sister''s graduation',       'Bhopal, Madhya Pradesh', DATE '2026-11-05', DATE '2026-11-08', 'approved', 'Approved. Carry your hostel ID.'),
    ('TST26-011', 'Internship interview',       'Bengaluru, Karnataka',   DATE '2026-11-18', DATE '2026-11-19', 'pending',  NULL),
    ('TST26-012', 'Weekend trip with friends',  'Coorg, Karnataka',       DATE '2026-11-01', DATE '2026-11-02', 'rejected', 'Insufficient notice; apply 3 days in advance.'),
    ('TST26-013', 'Dental treatment',           'Thiruvananthapuram',     DATE '2026-11-24', DATE '2026-11-25', 'pending',  NULL)
  ) AS t(sid, reason, destination, start_date, end_date, status, remark)
  LOOP
    SELECT * INTO v_student FROM public.students WHERE student_id = v.sid;
    CONTINUE WHEN NOT FOUND;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.leave_requests
      WHERE student_id = v_student.id AND reason = v.reason AND start_date = v.start_date
    );

    INSERT INTO public.leave_requests (student_id, reason, destination, start_date, end_date, emergency_contact, message)
    VALUES (v_student.id, v.reason, v.destination, v.start_date, v.end_date,
            COALESCE(v_student.guardian_phone, '+91 90000 00000'), 'Guardian informed.')
    RETURNING id INTO v_leave_id;

    IF v.status <> 'pending' THEN
      SELECT warden_id INTO v_warden FROM public.hostels WHERE id = v_student.hostel_id;
      UPDATE public.leave_requests
      SET status = v.status, remark = v.remark, approved_by = v_warden, updated_at = now()
      WHERE id = v_leave_id;
    END IF;
  END LOOP;
END;
$leave$;

-- ---------------------------------------------------------------------------
-- 7. Notices (5): global (admin) and hostel-specific (that hostel's warden).
-- ---------------------------------------------------------------------------
INSERT INTO public.notices (title, description, priority, hostel_id, posted_by)
SELECT v.title, v.descr, v.priority, h.id, p.id
FROM (VALUES
  ('Campus Wi-Fi maintenance on Saturday', 'Internet will be unavailable from 10 AM to 1 PM on Saturday for a network upgrade.', 'high',   NULL,                    'admin.test@hostel-test.example'),
  ('Annual hostel day registrations open', 'Register for cultural and sports events at the hostel office by Friday.',              'low',    NULL,                    'admin.test@hostel-test.example'),
  ('Water supply interruption in Block A',  'Overhead tank cleaning on Tuesday, 9 AM to 1 PM. Please store water in advance.',       'high',   '[TEST] Aravali House',  'warden.aravali@hostel-test.example'),
  ('Revised gate timings for Nilgiri',      'Gates close at 10:00 PM on weekdays and 10:30 PM on weekends, effective Monday.',       'medium', '[TEST] Nilgiri House',  'warden.nilgiri@hostel-test.example'),
  ('Shivalik House open for new allocations','Rooms in Shivalik House are ready. Pending students will be allocated this week.',      'medium', '[TEST] Shivalik House', 'warden.shivalik@hostel-test.example')
) AS v(title, descr, priority, hostel, poster_email)
LEFT JOIN public.hostels AS h ON h.name = v.hostel
LEFT JOIN public.profiles AS p ON lower(p.email) = v.poster_email
WHERE (v.hostel IS NULL OR h.id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.notices AS n WHERE n.title = v.title);

-- Keep the hostels.total_rooms column consistent with the room records.
UPDATE public.hostels AS h
SET total_rooms = (SELECT count(*) FROM public.rooms AS r WHERE r.hostel_id = h.id)
WHERE h.name LIKE '[TEST] %'
  AND total_rooms IS DISTINCT FROM (SELECT count(*) FROM public.rooms AS r WHERE r.hostel_id = h.id);

-- ---------------------------------------------------------------------------
-- 8. Consistency checks — any failure rolls back the whole seed.
-- ---------------------------------------------------------------------------
DO $check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.rooms AS r
    WHERE r.current_occupants <> (SELECT count(*) FROM public.students AS s WHERE s.room_id = r.id)
  ) THEN
    RAISE EXCEPTION 'Consistency check failed: room occupancy does not match allocations.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.students AS s JOIN public.rooms AS r ON r.id = s.room_id
    WHERE s.hostel_id IS DISTINCT FROM r.hostel_id
  ) THEN
    RAISE EXCEPTION 'Consistency check failed: student hostel differs from room hostel.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rooms WHERE current_occupants > capacity) THEN
    RAISE EXCEPTION 'Consistency check failed: a room is over capacity.';
  END IF;
END;
$check$;

COMMIT;

-- Summary (read-only)
SELECT
  (SELECT count(*) FROM public.hostels  WHERE name LIKE '[TEST] %')                              AS test_hostels,
  (SELECT count(*) FROM public.rooms r JOIN public.hostels h ON h.id = r.hostel_id WHERE h.name LIKE '[TEST] %') AS test_rooms,
  (SELECT count(*) FROM public.students WHERE student_id LIKE 'TST26-%')                          AS test_students,
  (SELECT count(*) FROM public.students WHERE student_id LIKE 'TST26-%' AND room_id IS NULL)      AS awaiting_allocation,
  (SELECT count(*) FROM public.students WHERE student_id LIKE 'TST26-%' AND user_id IS NOT NULL)  AS linked_to_login,
  (SELECT count(*) FROM public.complaints c JOIN public.students s ON s.id = c.student_id WHERE s.student_id LIKE 'TST26-%') AS test_complaints,
  (SELECT count(*) FROM public.leave_requests l JOIN public.students s ON s.id = l.student_id WHERE s.student_id LIKE 'TST26-%') AS test_leave,
  (SELECT count(*) FROM public.profiles WHERE email LIKE '%@hostel-test.example' AND role IN ('admin', 'warden')) AS test_staff_accounts;
