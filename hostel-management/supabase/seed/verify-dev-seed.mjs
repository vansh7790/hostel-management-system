// READ-ONLY verification of the dev project after seeding. Prints counts and
// pass/fail checks only (no personal data, no keys). Uses the same guarded
// seed.env.local as create-test-accounts.mjs.
//   npm run seed:verify
import { createClient } from '@supabase/supabase-js';
import { TEST_ACCOUNTS } from './test-accounts.mjs';

const url = process.env.SEED_SUPABASE_URL?.trim();
const serviceKey = process.env.SEED_SUPABASE_SERVICE_ROLE_KEY?.trim();
const allowedRef = process.env.SEED_ALLOWED_PROJECT_REF?.trim();
const projectRef = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1];
if (!url || !serviceKey || !allowedRef || projectRef !== allowedRef) {
  console.error('ABORTED: SEED_SUPABASE_URL / SEED_SUPABASE_SERVICE_ROLE_KEY / SEED_ALLOWED_PROJECT_REF missing or mismatched.');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const must = (result, what) => {
  if (result.error) {
    console.error(`ERROR reading ${what}: ${result.error.message}`);
    process.exit(1);
  }
  return result.data;
};

console.log(`Project: ${projectRef}`);
const marker = await db.rpc('dev_environment_marker');
check('dev environment marker present', marker.data === true, marker.error?.message);

const hostels = must(await db.from('hostels').select('id, name, warden_id').like('name', '[TEST] %'), 'hostels');
const hostelIds = hostels.map((h) => h.id);
const rooms = hostelIds.length ? must(await db.from('rooms').select('id, hostel_id, capacity, current_occupants, status').in('hostel_id', hostelIds), 'rooms') : [];
const students = must(await db.from('students').select('id, room_id, hostel_id, user_id, student_id').like('student_id', 'TST26-%'), 'students');
const allAllocated = must(await db.from('students').select('room_id, hostel_id').not('room_id', 'is', null), 'allocations');
const studentIds = students.map((s) => s.id);
const complaints = studentIds.length ? must(await db.from('complaints').select('status').in('student_id', studentIds), 'complaints') : [];
const leave = studentIds.length ? must(await db.from('leave_requests').select('status').in('student_id', studentIds), 'leave') : [];
const notices = must(await db.from('notices').select('id, hostel_id'), 'notices');
const staffEmails = TEST_ACCOUNTS.filter((a) => a.role !== 'student').map((a) => a.email);
const staff = must(await db.from('profiles').select('email, role').in('email', staffEmails), 'staff profiles');

const pending = students.filter((s) => !s.room_id).length;
const linked = students.filter((s) => s.user_id).length;
console.log(`Summary: hostels=${hostels.length} rooms=${rooms.length} students=${students.length} awaiting=${pending} linked=${linked} complaints=${complaints.length} leave=${leave.length} notices=${notices.length}`);

check('3 test hostels', hostels.length === 3);
check('15 test rooms', rooms.length === 15);
check('20 test students', students.length === 20);
check('6 awaiting allocation', pending === 6);
check('8 linked to logins', linked === 8, linked === 0 ? 'run npm run seed:accounts, then re-run dev_seed.sql' : '');
check('12 complaints', complaints.length === 12);
check('9 leave requests', leave.length === 9);
check('admin + 3 wardens promoted', staff.filter((p) => p.role === 'admin').length === 1 && staff.filter((p) => p.role === 'warden').length === 3,
  `${staff.length}/4 staff profiles found`);
check('every test hostel has a warden', hostels.every((h) => h.warden_id));

const countByRoom = new Map();
for (const s of allAllocated) countByRoom.set(s.room_id, (countByRoom.get(s.room_id) || 0) + 1);
const badOccupancy = rooms.filter((r) => r.current_occupants !== (countByRoom.get(r.id) || 0));
check('occupancy matches actual allocations in every room', badOccupancy.length === 0, `${badOccupancy.length} mismatched`);
check('no room over capacity', rooms.every((r) => r.current_occupants <= r.capacity));
const roomHostel = new Map(rooms.map((r) => [r.id, r.hostel_id]));
check('allocated students are in their room\'s hostel', students.filter((s) => s.room_id).every((s) => s.hostel_id === roomHostel.get(s.room_id)));
check('room states present: full, available, maintenance',
  ['full', 'available', 'maintenance'].every((status) => rooms.some((r) => r.status === status)));

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
