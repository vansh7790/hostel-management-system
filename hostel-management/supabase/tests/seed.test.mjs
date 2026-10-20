// Dev seed tests: guard, consistency, idempotency, linking, RLS with seeded
// personas, and cleanup. Runs in in-memory Postgres (PGlite); never touches a
// real project. Test logins are simulated by inserting into the stub auth.users
// exactly as Supabase Auth would (local harness only).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshDb, as, sys, createAuthUser } from './harness.mjs';
import { TEST_ACCOUNTS } from '../seed/test-accounts.mjs';

const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed');
const seedSql = (name) => readFileSync(join(SEED_DIR, name), 'utf8');
const MIGRATIONS = [
  'migrations/20261018130000_pending_allocation_intended_hostel.sql',
  'migrations/20261019120000_allow_pending_student_room_allocation.sql',
  'migrations/20261020120000_secure_student_account_linking.sql',
  'migrations/20261021120000_complaint_workflow_integrity.sql',
];

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label} ${detail}`); }
};
const run = async (db, file) => {
  try { await db.exec(seedSql(file)); return null; } catch (e) { await db.exec('ROLLBACK').catch(() => {}); return e.message; }
};
const one = async (db, sql, params) => (await sys(db, sql, params))[0];
const createAccounts = async (db) => {
  for (const a of TEST_ACCOUNTS) await createAuthUser(db, a.email, { studentId: a.studentId, name: a.fullName });
};
const idOf = async (db, email) => (await one(db, `SELECT id FROM auth.users WHERE email=$1`, [email])).id;

const counts = (db) => one(db, `SELECT
  (SELECT count(*)::int FROM public.hostels WHERE name LIKE '[TEST] %') AS hostels,
  (SELECT count(*)::int FROM public.rooms r JOIN public.hostels h ON h.id=r.hostel_id WHERE h.name LIKE '[TEST] %') AS rooms,
  (SELECT count(*)::int FROM public.students WHERE student_id LIKE 'TST26-%') AS students,
  (SELECT count(*)::int FROM public.students WHERE student_id LIKE 'TST26-%' AND room_id IS NULL) AS pending,
  (SELECT count(*)::int FROM public.students WHERE student_id LIKE 'TST26-%' AND user_id IS NOT NULL) AS linked,
  (SELECT count(*)::int FROM public.complaints) AS complaints,
  (SELECT count(*)::int FROM public.leave_requests) AS leave,
  (SELECT count(*)::int FROM public.notices) AS notices`);

// ---- Guard: no marker -> abort, nothing written ----
{
  const { db } = await freshDb(MIGRATIONS);
  await createAccounts(db);
  const err = await run(db, 'dev_seed.sql');
  check('seed refuses to run without dev marker', /Not a marked development project/.test(err || ''), err);
  check('aborted seed wrote nothing', (await counts(db)).hostels === 0);
  const cerr = await run(db, 'dev_seed_cleanup.sql');
  check('cleanup refuses to run without dev marker', /Not a marked development project/.test(cerr || ''), cerr);
}

// ---- Main path: accounts first, then seed ----
const { db } = await freshDb(MIGRATIONS);
// A pre-existing "real" record that must survive seeding and cleanup.
await sys(db, `INSERT INTO public.hostels(name,type) VALUES ('Real Hostel','boys')`);
await sys(db, `INSERT INTO public.students(student_id,name,email) VALUES ('REAL-1','Real Person','real.person@college.edu')`);
check('dev marker applies', !(await run(db, '00_mark_dev_environment.sql')));
check('marker re-run is idempotent', !(await run(db, '00_mark_dev_environment.sql')));
const markerFn = async (role) => {
  try {
    await db.exec('BEGIN'); await db.exec(`SET LOCAL ROLE ${role}`);
    const r = await db.query('SELECT public.dev_environment_marker() AS ok'); await db.exec('ROLLBACK'); return r.rows[0].ok;
  } catch (e) { await db.exec('ROLLBACK').catch(() => {}); return `denied: ${e.message}`; }
};
check('service_role can read the dev marker', (await markerFn('service_role')) === true);
check('authenticated cannot call the dev marker', String(await markerFn('authenticated')).startsWith('denied'));
check('anon cannot call the dev marker', String(await markerFn('anon')).startsWith('denied'));
check('dev marker table has RLS enabled',
  (await one(db, `SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'private.dev_environment'::regclass`)).rls === true);
const markerTable = async (role, sql) => {
  try {
    await db.exec('BEGIN'); await db.exec(`SET LOCAL ROLE ${role}`);
    const r = await db.query(sql); await db.exec('ROLLBACK'); return `allowed (${r.rows.length} rows)`;
  } catch (e) { await db.exec('ROLLBACK').catch(() => {}); return `denied: ${e.message}`; }
};
for (const role of ['anon', 'authenticated']) {
  check(`${role} cannot read dev marker table`, (await markerTable(role, 'SELECT * FROM private.dev_environment')).startsWith('denied'));
  check(`${role} cannot modify dev marker table`, (await markerTable(role, 'DELETE FROM private.dev_environment')).startsWith('denied'));
}
// Even with an accidental grant, RLS (no policies) must still hide and protect the row.
await db.exec('GRANT USAGE ON SCHEMA private TO anon; GRANT SELECT, DELETE ON private.dev_environment TO authenticated, anon');
check('with an accidental grant, RLS still returns 0 rows', (await markerTable('authenticated', 'SELECT * FROM private.dev_environment')) === 'allowed (0 rows)');
check('with an accidental grant, RLS still blocks deletes',
  (await markerTable('authenticated', 'DELETE FROM private.dev_environment RETURNING id')) === 'allowed (0 rows)');
await db.exec('REVOKE SELECT, DELETE ON private.dev_environment FROM authenticated, anon; REVOKE USAGE ON SCHEMA private FROM anon');
check('marker row still present after attempts', (await one(db, 'SELECT count(*)::int AS n FROM private.dev_environment')).n === 1);
check('service_role still reads marker through function (RLS bypass as owner)', (await markerFn('service_role')) === true);
await createAccounts(db);
const seedErr = await run(db, 'dev_seed.sql');
check('seed applies cleanly', !seedErr, seedErr);

const c = await counts(db);
check('3 hostels, 15 rooms, 20 students', c.hostels === 3 && c.rooms === 15 && c.students === 20, JSON.stringify(c));
check('6 students awaiting allocation', c.pending === 6, JSON.stringify(c));
check('8 student records linked to logins', c.linked === 8, JSON.stringify(c));
check('12 complaints, 9 leave, 5 notices', c.complaints === 12 && c.leave === 9 && c.notices === 5, JSON.stringify(c));

const roles = await one(db, `SELECT count(*) FILTER (WHERE role='admin')::int AS admins, count(*) FILTER (WHERE role='warden')::int AS wardens
  FROM public.profiles WHERE email LIKE '%@hostel-test.example'`);
check('1 admin and 3 warden test accounts promoted', roles.admins === 1 && roles.wardens === 3, JSON.stringify(roles));
const unassigned = await one(db, `SELECT count(*)::int AS n FROM public.hostels WHERE name LIKE '[TEST] %' AND warden_id IS NULL`);
check('every test hostel has its warden', unassigned.n === 0);
const linkCheck = await one(db, `SELECT count(*)::int AS n FROM public.students s JOIN auth.users u ON u.id=s.user_id
  WHERE lower(s.email)<>lower(u.email) OR upper(s.student_id)<>upper(u.raw_user_meta_data->>'student_id')`);
check('every link matches email and student ID', linkCheck.n === 0);
const real = await one(db, `SELECT user_id FROM public.students WHERE student_id='REAL-1'`);
check('pre-existing real record untouched', real && real.user_id === null);

const room = async (num) => one(db, `SELECT current_occupants AS occ, capacity AS cap, status FROM public.rooms WHERE room_number=$1`, [num]);
const a101 = await room('A-101'), a102 = await room('A-102'), a203 = await room('A-203'), a202 = await room('A-202');
check('A-101 full (2/2)', a101.occ === 2 && a101.status === 'full', JSON.stringify(a101));
check('A-102 partially occupied (1/2, available)', a102.occ === 1 && a102.status === 'available', JSON.stringify(a102));
check('A-202 empty and available', a202.occ === 0 && a202.status === 'available', JSON.stringify(a202));
check('A-203 empty and under maintenance', a203.occ === 0 && a203.status === 'maintenance', JSON.stringify(a203));
const shivalik = await one(db, `SELECT count(*)::int AS n FROM public.students s JOIN public.hostels h ON h.id=s.hostel_id WHERE h.name='[TEST] Shivalik House'`);
check('Shivalik House has no residents (empty hostel)', shivalik.n === 0);
const occMismatch = await one(db, `SELECT count(*)::int AS n FROM public.rooms r WHERE r.current_occupants <> (SELECT count(*) FROM public.students s WHERE s.room_id=r.id)`);
check('occupancy equals allocations for every room', occMismatch.n === 0);

const cs = await one(db, `SELECT count(*) FILTER (WHERE status='pending')::int AS p, count(*) FILTER (WHERE status='in_progress')::int AS i, count(*) FILTER (WHERE status='resolved')::int AS r FROM public.complaints`);
check('complaints: 6 pending, 3 in progress, 3 resolved', cs.p === 6 && cs.i === 3 && cs.r === 3, JSON.stringify(cs));
const ls = await one(db, `SELECT count(*) FILTER (WHERE status='pending')::int AS p, count(*) FILTER (WHERE status='approved')::int AS a, count(*) FILTER (WHERE status='rejected')::int AS r FROM public.leave_requests`);
check('leave: 4 pending, 3 approved, 2 rejected', ls.p === 4 && ls.a === 3 && ls.r === 2, JSON.stringify(ls));
const badApprover = await one(db, `SELECT count(*)::int AS n FROM public.leave_requests l JOIN public.students s ON s.id=l.student_id JOIN public.hostels h ON h.id=s.hostel_id
  WHERE l.status<>'pending' AND l.approved_by IS DISTINCT FROM h.warden_id`);
check('decided leave approved_by = that hostel\'s warden', badApprover.n === 0);

// ---- Idempotency ----
check('seed re-run succeeds', !(await run(db, 'dev_seed.sql')));
check('seed re-run creates no duplicates', JSON.stringify(await counts(db)) === JSON.stringify(c), JSON.stringify(await counts(db)));

// ---- RLS with seeded personas ----
const wA = await idOf(db, 'warden.aravali@hostel-test.example');
const wN = await idOf(db, 'warden.nilgiri@hostel-test.example');
const wS = await idOf(db, 'warden.shivalik@hostel-test.example');
const aarav = await idOf(db, 'aarav.mehta@hostel-test.example');
const meera = await idOf(db, 'meera.joshi@hostel-test.example');
const seen = async (uid, sql) => (await as(db, uid, sql)).rows.length;
check('Aravali warden sees 11 students (8 resident + 3 pending)', (await seen(wA, `SELECT id FROM public.students`)) === 11);
check('Nilgiri warden sees 8 students', (await seen(wN, `SELECT id FROM public.students`)) === 8);
check('Shivalik warden sees only its 1 pending student', (await seen(wS, `SELECT id FROM public.students`)) === 1);
check('Aravali warden sees only Aravali rooms (8)', (await seen(wA, `SELECT id FROM public.rooms`)) === 8);
check('Aravali warden sees 6 resident complaints', (await seen(wA, `SELECT id FROM public.complaints`)) === 6);
check('Nilgiri warden cannot see Aravali leave', (await seen(wN, `SELECT l.id FROM public.leave_requests l JOIN public.students s ON s.id=l.student_id WHERE s.student_id='TST26-001'`)) === 0);
check('student Aarav sees only own record', (await seen(aarav, `SELECT id FROM public.students`)) === 1);
check('student Aarav sees 2 global + 1 Aravali notice', (await seen(aarav, `SELECT id FROM public.notices`)) === 3);
check('pending student Meera sees only global notices', (await seen(meera, `SELECT id FROM public.notices`)) === 2);
const mRoom = (await as(db, meera, `SELECT room_id, intended_hostel_id FROM public.students`)).rows[0];
check('pending student Meera has no room but an intended hostel', mRoom && mRoom.room_id === null && mRoom.intended_hostel_id);
const nRoom = await one(db, `SELECT r.id FROM public.rooms r WHERE r.room_number='N-202'`);
const meeraRec = await one(db, `SELECT id FROM public.students WHERE student_id='TST26-017'`);
const alloc = await as(db, wN, `UPDATE public.students SET room_id=$2 WHERE id=$1 RETURNING room_id`, [meeraRec.id, nRoom.id]);
check('Nilgiri warden allocates pending Meera to N-202', !alloc.error && alloc.rows.length === 1, JSON.stringify(alloc));
const a203Id = (await one(db, `SELECT id FROM public.rooms WHERE room_number='A-203'`)).id;
const nikhil = (await one(db, `SELECT id FROM public.students WHERE student_id='TST26-016'`)).id;
const maint = await as(db, wA, `UPDATE public.students SET room_id=$2 WHERE id=$1`, [nikhil, a203Id]);
check('allocation into seeded maintenance room rejected', !!maint.error && /maintenance/i.test(maint.error), JSON.stringify(maint));

// ---- Cleanup ----
check('cleanup runs', !(await run(db, 'dev_seed_cleanup.sql')));
const after = await counts(db);
check('cleanup removes all test hostels/rooms/students/requests/notices',
  after.hostels === 0 && after.rooms === 0 && after.students === 0 && after.complaints === 0 && after.leave === 0 && after.notices === 0, JSON.stringify(after));
check('cleanup keeps non-test hostel and student',
  (await one(db, `SELECT count(*)::int AS n FROM public.hostels WHERE name='Real Hostel'`)).n === 1
  && (await one(db, `SELECT count(*)::int AS n FROM public.students WHERE student_id='REAL-1'`)).n === 1);
check('reseed after cleanup restores the dataset', !(await run(db, 'dev_seed.sql')) && (await counts(db)).students === 20);

// ---- Alternate order: seed first, logins created afterwards ----
{
  const { db: db2 } = await freshDb(MIGRATIONS);
  await db2.exec(seedSql('00_mark_dev_environment.sql'));
  check('seed without any logins still applies', !(await run(db2, 'dev_seed.sql')));
  await createAccounts(db2);
  const linked = await one(db2, `SELECT count(*)::int AS n FROM public.students WHERE user_id IS NOT NULL`);
  check('logins created after seeding link via auth trigger (8)', linked.n === 8, JSON.stringify(linked));
  check('re-running seed then assigns wardens', !(await run(db2, 'dev_seed.sql'))
    && (await one(db2, `SELECT count(*)::int AS n FROM public.hostels WHERE warden_id IS NULL`)).n === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
