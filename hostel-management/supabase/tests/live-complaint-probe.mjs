// LIVE complaint-workflow security probe against the DEVELOPMENT project only.
//   npm run test:live-dev
//
// Safety:
//  * Aborts unless the URL/ref is exactly the dev project AND the database
//    carries the dev marker (public.dev_environment_marker() via service role).
//  * Uses only fictional seeded accounts/records (student IDs TST26-*).
//  * Snapshots the target complaint and proves the restore path works BEFORE
//    any probe; restores every changed column and deletes the temporary
//    complaint in a finally block, then verifies the row equals the snapshot.
//  * Never prints keys, passwords, or tokens.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'fdjixdmgcdljgncxsein';
const results = [];
const record = (name, status, evidence) => results.push({ name, status, evidence });
const abort = (message) => {
  console.error(`ABORTED (no data changed): ${message}`);
  process.exit(2);
};
const short = (error) => (error ? `${error.code || ''} ${error.message || ''}`.trim().slice(0, 110) : 'no error');

// ---------------------------------------------------------------- guards
const url = process.env.SEED_SUPABASE_URL?.trim();
const serviceKey = process.env.SEED_SUPABASE_SERVICE_ROLE_KEY?.trim();
const allowedRef = process.env.SEED_ALLOWED_PROJECT_REF?.trim();
const password = process.env.SEED_TEST_PASSWORD;
const ref = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1];
if (!url || !serviceKey || !allowedRef || !password) abort('seed.env.local is incomplete.');
if (ref !== DEV_REF || allowedRef !== DEV_REF) abort(`project ref is not the dev project (${ref}).`);

const devEnv = readFileSync(new URL('../../.env.development.local', import.meta.url), 'utf8');
const publishableKey = devEnv.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();
const devUrl = devEnv.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
if (!publishableKey || devUrl?.replace(/\/$/, '') !== url.replace(/\/$/, '')) abort('.env.development.local does not point at the same dev project.');

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const service = createClient(url, serviceKey, clientOptions);
const marker = await service.rpc('dev_environment_marker');
if (marker.error || marker.data !== true) abort(`dev marker check failed (${short(marker.error)}).`);
console.log(`Guards passed: project ${ref}, dev marker present.`);

// ---------------------------------------------------------------- fixtures (service role reads)
const studentByCode = async (code) => {
  const { data, error } = await service.from('students').select('id, room_id, hostel_id, student_id').eq('student_id', code).maybeSingle();
  if (error || !data) abort(`seeded student ${code} not found (${short(error)}).`);
  return data;
};
const owner = await studentByCode('TST26-003');   // Rohan Iyer, Aravali
const other = await studentByCode('TST26-002');   // Kabir Singh, Aravali (same hostel)
const prober = await studentByCode('TST26-001');  // Aarav Mehta (has a login)

const { data: targets, error: targetError } = await service.from('complaints').select('*').eq('student_id', owner.id).order('created_at').limit(1);
if (targetError || !targets?.length) abort(`no complaint found for TST26-003 (${short(targetError)}).`);
const snapshot = targets[0];
const { data: rooms } = await service.from('rooms').select('id').eq('hostel_id', owner.hostel_id).neq('id', snapshot.room_id || '00000000-0000-0000-0000-000000000000').limit(1);
const otherRoomId = rooms?.[0]?.id;
if (!otherRoomId) abort('no alternative Aravali room found for the room_id probe.');
const { count: proberCountBefore } = await service.from('complaints').select('id', { count: 'exact', head: true }).eq('student_id', prober.id);

const readTarget = async () => (await service.from('complaints').select('*').eq('id', snapshot.id).single()).data;
const sameAsSnapshot = (row) => JSON.stringify(row) === JSON.stringify(snapshot);

// Prove the restore path before changing anything: a no-op write via service role.
const noop = await service.from('complaints').update({ status: snapshot.status, updated_at: snapshot.updated_at }).eq('id', snapshot.id).select('id');
if (noop.error || noop.data?.length !== 1 || !sameAsSnapshot(await readTarget())) abort(`restore path unavailable (${short(noop.error)}).`);
console.log(`Target: complaint of TST26-003 (status ${snapshot.status}); restore path verified.\n`);

// ---------------------------------------------------------------- sign in fictional accounts
const signIn = async (email) => {
  const client = createClient(url, publishableKey, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? { client: null, error } : { client, error: null };
};
const wardenA = await signIn('warden.aravali@hostel-test.example');
const wardenN = await signIn('warden.nilgiri@hostel-test.example');
const student = await signIn('aarav.mehta@hostel-test.example');

let probeComplaintId = null;
try {
  // ---- 1-5: unauthorized column changes by the assigned warden
  const probes = [
    ['title', { title: 'TST26 probe: title changed by warden' }],
    ['description', { description: 'TST26 probe: description changed by warden' }],
    ['category', { category: snapshot.category === 'other' ? 'plumbing' : 'other' }],
    ['student_id', { student_id: other.id }],
    ['room_id', { room_id: otherRoomId }],
  ];
  for (const [column, change] of probes) {
    const name = `Aravali warden cannot change ${column}`;
    if (!wardenA.client) { record(name, 'NOT RUN', `warden sign-in failed: ${short(wardenA.error)}`); continue; }
    const res = await wardenA.client.from('complaints').update(change).eq('id', snapshot.id).select('id');
    const unchanged = sameAsSnapshot(await readTarget());
    const rejected = Boolean(res.error) || res.data?.length === 0;
    record(name, rejected && unchanged ? 'PASS' : 'FAIL', `${short(res.error)} | rows=${res.data?.length ?? 0} | row unchanged=${unchanged}`);
  }

  // ---- 6: warden of another hostel cannot update
  {
    const name = 'Nilgiri warden cannot update Aravali complaint';
    if (!wardenN.client) record(name, 'NOT RUN', `warden sign-in failed: ${short(wardenN.error)}`);
    else {
      const res = await wardenN.client.from('complaints').update({ status: snapshot.status === 'resolved' ? 'pending' : 'resolved' }).eq('id', snapshot.id).select('id');
      const unchanged = sameAsSnapshot(await readTarget());
      const blocked = Boolean(res.error) || res.data?.length === 0;
      record(name, blocked && unchanged ? 'PASS' : 'FAIL', `${short(res.error)} | rows=${res.data?.length ?? 0} | row unchanged=${unchanged}`);
    }
  }

  // ---- 7: legitimate status update by the assigned warden (then restored)
  {
    const name = 'Aravali warden can update status (legitimate)';
    const next = snapshot.status === 'pending' ? 'in_progress' : snapshot.status === 'in_progress' ? 'resolved' : 'in_progress';
    if (!wardenA.client) record(name, 'NOT RUN', `warden sign-in failed: ${short(wardenA.error)}`);
    else {
      const res = await wardenA.client.from('complaints').update({ status: next, updated_at: new Date().toISOString() }).eq('id', snapshot.id).select('status');
      const stored = (await readTarget())?.status;
      record(name, !res.error && res.data?.[0]?.status === next && stored === next ? 'PASS' : 'FAIL',
        `${snapshot.status} -> ${next} | ${short(res.error)} | stored=${stored}`);
    }
  }

  // ---- 8: student cannot create a complaint already resolved
  {
    const name = 'Student insert with status=resolved is stored as pending';
    if (!student.client) record(name, 'NOT RUN', `student sign-in failed: ${short(student.error)}`);
    else {
      const res = await student.client.from('complaints').insert({
        student_id: prober.id, room_id: prober.room_id, title: 'TST26 live probe (temporary)',
        category: 'other', description: 'Temporary security probe record; deleted automatically.', status: 'resolved',
      }).select('id, status').single();
      probeComplaintId = res.data?.id || null;
      const stored = probeComplaintId ? (await service.from('complaints').select('status').eq('id', probeComplaintId).single()).data?.status : null;
      record(name, !res.error && stored === 'pending' ? 'PASS' : 'FAIL', `${short(res.error)} | returned=${res.data?.status} | stored=${stored}`);
    }
  }
} finally {
  // ---------------------------------------------------------------- cleanup (always)
  const current = await readTarget();
  const restore = {};
  for (const key of ['title', 'description', 'category', 'status', 'student_id', 'room_id', 'updated_at']) {
    if (JSON.stringify(current?.[key]) !== JSON.stringify(snapshot[key])) restore[key] = snapshot[key];
  }
  if (Object.keys(restore).length) {
    const { error } = await service.from('complaints').update(restore).eq('id', snapshot.id);
    if (error) console.error(`CLEANUP ERROR restoring target: ${short(error)}`);
  }
  if (probeComplaintId) {
    const { error } = await service.from('complaints').delete().eq('id', probeComplaintId);
    if (error) console.error(`CLEANUP ERROR deleting probe complaint: ${short(error)}`);
  }
  const restored = sameAsSnapshot(await readTarget());
  const { count: proberCountAfter } = await service.from('complaints').select('id', { count: 'exact', head: true }).eq('student_id', prober.id);
  const probeGone = probeComplaintId
    ? !(await service.from('complaints').select('id').eq('id', probeComplaintId).maybeSingle()).data
    : true;
  record('Cleanup: target complaint identical to snapshot', restored ? 'PASS' : 'FAIL', `restored columns: ${Object.keys(restore).join(', ') || 'none needed'}`);
  record('Cleanup: temporary complaint deleted, student count unchanged', probeGone && proberCountAfter === proberCountBefore ? 'PASS' : 'FAIL',
    `before=${proberCountBefore} after=${proberCountAfter} probeGone=${probeGone}`);
  await Promise.all([wardenA, wardenN, student].map((s) => s.client?.auth.signOut()));

  for (const r of results) console.log(`${r.status.padEnd(7)} ${r.name}\n        ${r.evidence}`);
  const failed = results.filter((r) => r.status !== 'PASS').length;
  console.log(`\n${results.length - failed} PASS, ${results.filter((r) => r.status === 'FAIL').length} FAIL, ${results.filter((r) => r.status === 'NOT RUN').length} NOT RUN`);
  process.exitCode = failed ? 1 : 0;
}
