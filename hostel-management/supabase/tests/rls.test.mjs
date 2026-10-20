// Database security and workflow tests. Applies initial_setup_review3.sql plus the
// migrations in deployment order to an in-memory Postgres (PGlite) and exercises
// RLS/triggers as simulated Supabase users. Never touches the live project.
// Run: npm run test:db
import { freshDb, as, sys, createAuthUser } from './harness.mjs';

// Every supported deployment order must apply cleanly.
for (const seq of [
  ['migrations/20261018130000_pending_allocation_intended_hostel.sql', 'migrations/20261020120000_secure_student_account_linking.sql', 'migrations/20261021120000_complaint_workflow_integrity.sql'],
  ['migrations/20261018130000_pending_allocation_intended_hostel.sql', 'migrations/20261020120000_secure_student_account_linking.sql', 'migrations/20261019120000_allow_pending_student_room_allocation.sql', 'migrations/20261021120000_complaint_workflow_integrity.sql'],
]) {
  const { results } = await freshDb(seq);
  const bad = results.find((r) => !r.ok);
  if (bad) { console.log(`FAIL migration order ${seq.join(' -> ')}: ${bad.name}: ${bad.error}`); process.exit(1); }
}
console.log('PASS migrations apply in both supported orders');

const { db, results } = await freshDb([
  'migrations/20261018130000_pending_allocation_intended_hostel.sql',
  'migrations/20261019120000_allow_pending_student_room_allocation.sql',
  'migrations/20261020120000_secure_student_account_linking.sql',
  'migrations/20261021120000_complaint_workflow_integrity.sql',
]);
if (results.some((r) => !r.ok)) { console.error(results); process.exit(1); }

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.log(`FAIL ${label} ${detail}`); }
};
const userIdOf = async (studentRow) => (await sys(db, 'SELECT user_id FROM public.students WHERE id=$1', [studentRow]))[0].user_id;

// ---- Accounts (signup trigger creates student profiles) ----
const admin = await createAuthUser(db, 'admin@x.edu', { name: 'Admin' });
const w1 = await createAuthUser(db, 'w1@x.edu', { name: 'Warden One' });
const w2 = await createAuthUser(db, 'w2@x.edu', { name: 'Warden Two' });
await sys(db, `UPDATE public.profiles SET role='admin' WHERE id=$1`, [admin]);
await sys(db, `UPDATE public.profiles SET role='warden' WHERE id IN ($1,$2)`, [w1, w2]);
check('signup trigger forces student role', (await sys(db, `SELECT role FROM public.profiles WHERE id=$1`, [
  await createAuthUser(db, 'sneaky@x.edu', { name: 'Sneaky' }),
]))[0].role === 'student');

// ---- Admin: hostels + rooms ----
const hA = (await as(db, admin, `INSERT INTO public.hostels(name,type,warden_id) VALUES ('Hostel A','boys',$1) RETURNING id`, [w1])).rows[0].id;
const hB = (await as(db, admin, `INSERT INTO public.hostels(name,type,warden_id) VALUES ('Hostel B','girls',$1) RETURNING id`, [w2])).rows[0].id;
check('admin creates hostels', hA && hB);
check('warden cannot create hostel', !!(await as(db, w1, `INSERT INTO public.hostels(name,type) VALUES ('X','boys')`)).error);
const r101 = (await as(db, admin, `INSERT INTO public.rooms(hostel_id,room_number,capacity) VALUES ($1,'101',1) RETURNING id`, [hA])).rows[0].id;
const r102 = (await as(db, admin, `INSERT INTO public.rooms(hostel_id,room_number,capacity) VALUES ($1,'102',2) RETURNING id`, [hA])).rows[0].id;
const rB1 = (await as(db, admin, `INSERT INTO public.rooms(hostel_id,room_number,capacity) VALUES ($1,'B1',2) RETURNING id`, [hB])).rows[0].id;
check('admin creates rooms', r101 && r102 && rB1);
check('duplicate room number rejected', !!(await as(db, admin, `INSERT INTO public.rooms(hostel_id,room_number) VALUES ($1,'101')`, [hA])).error);

// ---- Onboarding flow 1: record first, then signup + confirm ----
const insStudent = (email, sid, name, hostel) => as(db, admin,
  `INSERT INTO public.students(student_id,name,email,intended_hostel_id) VALUES ($1,$2,$3,$4) RETURNING id, user_id`, [sid, name, email, hostel]);
const s1rec = (await insStudent('s1@x.edu', 'S1', 'Student One', hA)).rows[0];
check('admin creates unlinked pending student', s1rec && s1rec.user_id === null);
const s1 = await createAuthUser(db, 's1@x.edu', { confirmed: false, studentId: 'S1', name: 'Student One' });
check('unconfirmed signup is NOT linked', (await userIdOf(s1rec.id)) === null);
await sys(db, `UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1`, [s1]);
check('email confirmation links record', (await userIdOf(s1rec.id)) === s1);

// ---- Onboarding flow 2: confirmed signup first, then admin creates record ----
const s2 = await createAuthUser(db, 's2@x.edu', { studentId: 'S2', name: 'Student Two' });
const s2rec = (await insStudent('s2@x.edu', 'S2', 'Student Two', hA)).rows[0];
check('record created after signup links via DB trigger', (await userIdOf(s2rec.id)) === s2);

// ---- Wrong student ID never links ----
const s3rec = (await insStudent('s3@x.edu', 'S3', 'Student Three', hB)).rows[0];
await createAuthUser(db, 's3@x.edu', { studentId: 'WRONG', name: 'Student Three' });
check('mismatched student ID is NOT linked', (await userIdOf(s3rec.id)) === null);

// ---- Hijack attempts ----
const attacker = await createAuthUser(db, 'evil@x.edu', { studentId: 'EVIL', name: 'Evil' });
const victim = (await insStudent('victim@x.edu', 'V1', 'Victim', hA)).rows[0];
check('attacker cannot set profile email to victim email',
  !!(await as(db, attacker, `UPDATE public.profiles SET email='victim@x.edu' WHERE id=$1`, [attacker])).error);
const self = await as(db, attacker, `UPDATE public.students SET user_id=$1 WHERE id=$2 RETURNING id`, [attacker, victim.id]);
check('attacker cannot claim unlinked record directly', !!self.error || self.rows.length === 0, JSON.stringify(self));
check('victim record still unlinked', (await userIdOf(victim.id)) === null);
check('student cannot escalate role',
  !!(await as(db, s1, `UPDATE public.profiles SET role='admin' WHERE id=$1`, [s1])).error);
check('student cannot insert a student record',
  !!(await as(db, s1, `INSERT INTO public.students(student_id,name,email) VALUES ('Z','Z','z@x.edu')`)).error);
const reassign = await as(db, w1, `UPDATE public.students SET user_id=$1 WHERE id=$2 RETURNING id`, [attacker, victim.id]);
check('warden cannot link a record to an arbitrary account', !!reassign.error || reassign.rows.length === 0, JSON.stringify(reassign));

// ---- Student self-update limits ----
check('student can update own phone',
  !(await as(db, s1, `UPDATE public.students SET phone='123' WHERE user_id=$1`, [s1])).error);
check('student cannot change own intended hostel',
  !!(await as(db, s1, `UPDATE public.students SET intended_hostel_id=$2 WHERE user_id=$1`, [s1, hB])).error);
check('student cannot change own name/email',
  !!(await as(db, s1, `UPDATE public.students SET email='other@x.edu' WHERE user_id=$1`, [s1])).error);
check('student cannot allocate own room',
  !!(await as(db, s1, `UPDATE public.students SET room_id=$2 WHERE user_id=$1`, [s1, r102])).error);
const peek = await as(db, s1, `SELECT id FROM public.students`);
check('student sees only own record', peek.rows.length === 1, JSON.stringify(peek));

// ---- Warden visibility + allocation ----
const w1sees = (await as(db, w1, `SELECT id FROM public.students WHERE intended_hostel_id=$1`, [hA])).rows.length;
const w2sees = (await as(db, w2, `SELECT id FROM public.students WHERE intended_hostel_id=$1`, [hA])).rows.length;
check('warden 1 sees pending students of hostel A', w1sees === 3, `saw ${w1sees}`);
check('warden 2 cannot see hostel A students', w2sees === 0, `saw ${w2sees}`);
const alloc = await as(db, w1, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING room_id, hostel_id`, [s1rec.id, r101]);
check('warden 1 allocates pending student', !alloc.error && alloc.rows[0]?.hostel_id === hA, JSON.stringify(alloc));
const room = (await sys(db, `SELECT current_occupants, status FROM public.rooms WHERE id=$1`, [r101]))[0];
check('occupancy synced and room full', room.current_occupants === 1 && room.status === 'full', JSON.stringify(room));
const over = await as(db, w1, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING id`, [s2rec.id, r101]);
check('allocation into full room rejected', !!over.error && /capacity/i.test(over.error), JSON.stringify(over));
const cross = await as(db, w1, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING id`, [s2rec.id, rB1]);
check('warden cannot allocate into another hostel room', !!cross.error || cross.rows.length === 0, JSON.stringify(cross));
const w2alloc = await as(db, w2, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING id`, [s2rec.id, rB1]);
check('warden 2 cannot allocate hostel A student', !!w2alloc.error || w2alloc.rows.length === 0, JSON.stringify(w2alloc));
const adminAlloc = await as(db, admin, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING hostel_id`, [s2rec.id, r102]);
check('admin allocates student', !adminAlloc.error && adminAlloc.rows[0]?.hostel_id === hA, JSON.stringify(adminAlloc));
const transfer = await as(db, admin, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING hostel_id`, [s2rec.id, rB1]);
const occ = await sys(db, `SELECT room_number, current_occupants FROM public.rooms WHERE id IN ($1,$2) ORDER BY room_number`, [r102, rB1]);
check('admin transfer updates both rooms', !transfer.error && occ.every((r) => r.current_occupants === (r.room_number === 'B1' ? 1 : 0)), JSON.stringify({ transfer, occ }));

// ---- Room maintenance and capacity edits ----
const rM = (await as(db, admin, `INSERT INTO public.rooms(hostel_id,room_number,capacity) VALUES ($1,'M1',2) RETURNING id`, [hA])).rows[0].id;
const maint = await as(db, admin, `UPDATE public.rooms SET status='maintenance' WHERE id=$1 RETURNING status`, [rM]);
check('admin puts room under maintenance', !maint.error && maint.rows[0]?.status === 'maintenance', JSON.stringify(maint));
const intoMaint = await as(db, admin, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING id`, [victim.id, rM]);
check('allocation into maintenance room rejected', !!intoMaint.error && /maintenance/i.test(intoMaint.error), JSON.stringify(intoMaint));
const shrink = await as(db, admin, `UPDATE public.rooms SET capacity=0 WHERE id=$1`, [r101]);
check('room capacity below occupancy rejected', !!shrink.error, JSON.stringify(shrink));
const back = await as(db, admin, `UPDATE public.rooms SET status='available' WHERE id=$1 RETURNING status`, [r101]);
check('full room status recomputed by database', back.rows[0]?.status === 'full', JSON.stringify(back));

// ---- Warden editing pending student email triggers safe auto-link ----
const s4 = await createAuthUser(db, 's4@x.edu', { studentId: 'S4', name: 'Four' });
const s4rec = (await insStudent('typo@x.edu', 'S4', 'Four', hA)).rows[0];
const fix = await as(db, admin, `UPDATE public.students SET email='s4@x.edu' WHERE id=$1 RETURNING id`, [s4rec.id]);
check('admin email correction links verified account', !fix.error && (await userIdOf(s4rec.id)) === s4, JSON.stringify(fix));
check('warden cannot edit pending student details (admin-only)',
  (await as(db, w1, `UPDATE public.students SET phone='1' WHERE id=$1 RETURNING id`, [victim.id])).rows.length === 0);
// Allocated-but-unlinked student in warden's hostel; warden corrects email -> verified link under warden JWT.
const s5 = await createAuthUser(db, 's5@x.edu', { studentId: 'S5', name: 'Five' });
const s5rec = (await insStudent('typo5@x.edu', 'S5', 'Five', hA)).rows[0];
await as(db, admin, `UPDATE public.students SET room_id=$2 WHERE id=$1`, [s5rec.id, r102]);
const wfix = await as(db, w1, `UPDATE public.students SET email='s5@x.edu' WHERE id=$1 RETURNING id`, [s5rec.id]);
check('warden email fix on allocated student links verified account', !wfix.error && (await userIdOf(s5rec.id)) === s5, JSON.stringify(wfix));
const wbad = await as(db, w1, `UPDATE public.students SET email='nobody@x.edu' WHERE id=$1 RETURNING user_id`, [r102 && s5rec.id]);
check('warden email edit cannot relink an already linked record', !!wbad.error || (await userIdOf(s5rec.id)) === s5, JSON.stringify(wbad));

// ---- Complaints ----
const c1 = await as(db, s1, `INSERT INTO public.complaints(student_id,room_id,title,category,description) VALUES ($1,$2,'Fan','electrical','Broken') RETURNING id,status`, [s1rec.id, r101]);
check('student files complaint for own room', !c1.error && c1.rows[0].status === 'pending', JSON.stringify(c1));
check('student cannot file complaint as another student',
  !!(await as(db, s1, `INSERT INTO public.complaints(student_id,title,category,description) VALUES ($1,'x','other','x')`, [s3rec.id])).error);
const cw = await as(db, w1, `UPDATE public.complaints SET status='in_progress' WHERE id=$1 RETURNING status`, [c1.rows[0].id]);
check('assigned warden updates complaint status', !cw.error && cw.rows[0]?.status === 'in_progress', JSON.stringify(cw));
const cwText = await as(db, w1, `UPDATE public.complaints SET description='edited by warden' WHERE id=$1 RETURNING id`, [c1.rows[0].id]);
check('warden cannot rewrite complaint text', !!cwText.error && /only the complaint status/i.test(cwText.error), JSON.stringify(cwText));
// Each remaining protected column, one at a time; the row must be unchanged afterwards.
const complaintRow = async (id) => (await sys(db, `SELECT to_jsonb(c) - 'updated_at' AS j FROM public.complaints c WHERE id=$1`, [id]))[0].j;
const c1Before = await complaintRow(c1.rows[0].id);
for (const [label, sql, params] of [
  ['title', `UPDATE public.complaints SET title='Renamed by warden' WHERE id=$1 RETURNING id`, [c1.rows[0].id]],
  ['category', `UPDATE public.complaints SET category='other' WHERE id=$1 RETURNING id`, [c1.rows[0].id]],
  ['student_id (same-hostel student)', `UPDATE public.complaints SET student_id=$2 WHERE id=$1 RETURNING id`, [c1.rows[0].id, s5rec.id]],
  ['room_id (same-hostel room)', `UPDATE public.complaints SET room_id=$2 WHERE id=$1 RETURNING id`, [c1.rows[0].id, r102]],
]) {
  const res = await as(db, w1, sql, params);
  const unchanged = JSON.stringify(await complaintRow(c1.rows[0].id)) === JSON.stringify(c1Before);
  check(`warden cannot change complaint ${label}`, !!res.error && unchanged, JSON.stringify({ res, unchanged }));
}
const cfake = await as(db, s1, `INSERT INTO public.complaints(student_id,room_id,title,category,description,status) VALUES ($1,$2,'Light','electrical','x','resolved') RETURNING id, status`, [s1rec.id, r101]);
check('student complaint inserted as resolved is forced to pending', !cfake.error && cfake.rows[0]?.status === 'pending', JSON.stringify(cfake));
const cownEdit = await as(db, s1, `UPDATE public.complaints SET description='more detail' WHERE id=$1 RETURNING description`, [cfake.rows[0].id]);
check('student can still edit own pending complaint text', !cownEdit.error && cownEdit.rows[0]?.description === 'more detail', JSON.stringify(cownEdit));
const cadmin = await as(db, admin, `UPDATE public.complaints SET title='Fan (admin corrected)' WHERE id=$1 RETURNING title`, [c1.rows[0].id]);
check('admin can still correct complaint text', !cadmin.error && cadmin.rows.length === 1, JSON.stringify(cadmin));
const cw2 = await as(db, w2, `UPDATE public.complaints SET status='resolved' WHERE id=$1 RETURNING status`, [c1.rows[0].id]);
check('other warden cannot update complaint', !!cw2.error || cw2.rows.length === 0, JSON.stringify(cw2));

// ---- Leave ----
const l1 = await as(db, s1, `INSERT INTO public.leave_requests(student_id,reason,destination,start_date,end_date,emergency_contact,status,approved_by) VALUES ($1,'Home','City','2026-11-01','2026-11-03','999','approved',$2) RETURNING id,status,approved_by`, [s1rec.id, s1]);
check('student leave forced to pending', !l1.error && l1.rows[0].status === 'pending' && l1.rows[0].approved_by === null, JSON.stringify(l1));
check('student cannot approve own leave',
  !!(await as(db, s1, `UPDATE public.leave_requests SET status='approved' WHERE id=$1`, [l1.rows[0].id])).error);
check('invalid leave date range rejected',
  !!(await as(db, s1, `INSERT INTO public.leave_requests(student_id,reason,destination,start_date,end_date,emergency_contact) VALUES ($1,'x','x','2026-11-05','2026-11-01','1')`, [s1rec.id])).error);
const lw = await as(db, w1, `UPDATE public.leave_requests SET status='approved', remark='ok' WHERE id=$1 RETURNING status, approved_by`, [l1.rows[0].id]);
check('warden approves leave; approved_by forced to warden', !lw.error && lw.rows[0]?.approved_by === w1, JSON.stringify(lw));

// ---- Notices ----
const nGlobalW = await as(db, w1, `INSERT INTO public.notices(title,description,posted_by) VALUES ('g','g',$1)`, [w1]);
check('warden cannot post global notice', !!nGlobalW.error);
const nA = await as(db, w1, `INSERT INTO public.notices(title,description,hostel_id,posted_by) VALUES ('a','a',$1,$2) RETURNING posted_by`, [hA, w1]);
check('warden posts hostel notice', !nA.error && nA.rows[0].posted_by === w1, JSON.stringify(nA));
const nG = await as(db, admin, `INSERT INTO public.notices(title,description,posted_by) VALUES ('g','g',$1) RETURNING id`, [admin]);
check('admin posts global notice', !nG.error, JSON.stringify(nG));
const s1n = (await as(db, s1, `SELECT id FROM public.notices`)).rows.length;
const s3acct = (await sys(db, `SELECT id FROM auth.users WHERE email='s3@x.edu'`))[0].id;
const evilN = (await as(db, attacker, `SELECT id FROM public.notices`)).rows.length;
check('hostel A student sees global + hostel A notices', s1n === 2, `saw ${s1n}`);
check('unlinked user sees only global notice', evilN === 1, `saw ${evilN} (s3=${s3acct})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
