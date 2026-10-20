// Creates (or deletes) the fictional DEV test logins through the Supabase Auth
// Admin API — the supported way to create users; nothing is inserted into
// auth.users directly. Accounts are created email-confirmed, so the database's
// verified-link trigger links student logins to their seeded records.
//
// Run locally only, never in CI or the browser:
//   node --env-file=supabase/seed/seed.env.local supabase/seed/create-test-accounts.mjs            (create missing)
//   node --env-file=supabase/seed/seed.env.local supabase/seed/create-test-accounts.mjs --reset-passwords
//   node --env-file=supabase/seed/seed.env.local supabase/seed/create-test-accounts.mjs --delete   (remove test logins)
//
// seed.env.local is git-ignored (*.local). See seed.env.example for the variables.
import { createClient } from '@supabase/supabase-js';
import { TEST_ACCOUNTS, TEST_EMAIL_DOMAIN } from './test-accounts.mjs';

const fail = (message) => {
  console.error(`ABORTED: ${message}`);
  process.exit(1);
};

const url = process.env.SEED_SUPABASE_URL?.trim();
const serviceKey = process.env.SEED_SUPABASE_SERVICE_ROLE_KEY?.trim();
const allowedRef = process.env.SEED_ALLOWED_PROJECT_REF?.trim();
const password = process.env.SEED_TEST_PASSWORD;
const mode = process.argv.includes('--delete') ? 'delete' : process.argv.includes('--reset-passwords') ? 'reset' : 'create';

if (!url || !serviceKey || !allowedRef) fail('Set SEED_SUPABASE_URL, SEED_SUPABASE_SERVICE_ROLE_KEY and SEED_ALLOWED_PROJECT_REF.');
const projectRef = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1];
if (!projectRef) fail('SEED_SUPABASE_URL must look like https://<project-ref>.supabase.co');
// Explicit opt-in: the operator must name the dev project they intend to modify.
if (projectRef !== allowedRef) fail(`URL project (${projectRef}) does not match SEED_ALLOWED_PROJECT_REF. Refusing to touch an unconfirmed project.`);
if (mode !== 'delete' && (!password || password.length < 12)) fail('SEED_TEST_PASSWORD must be set and at least 12 characters.');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Second guard: the database itself must be marked as a dev project
// (supabase/seed/00_mark_dev_environment.sql). Production never has this marker.
const { data: isDev, error: markerError } = await admin.rpc('dev_environment_marker');
if (markerError || isDev !== true) {
  fail(`Project ${projectRef} is not marked as a development database (${markerError?.message || 'marker missing'}). Run 00_mark_dev_environment.sql there first.`);
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`Could not list users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const existing = new Map((await listAllUsers()).map((user) => [user.email?.toLowerCase(), user]));
console.log(`Target project: ${projectRef} | mode: ${mode} | existing users: ${existing.size}`);

if (mode === 'delete') {
  const testUsers = [...existing.values()].filter((user) => user.email?.toLowerCase().endsWith(`@${TEST_EMAIL_DOMAIN}`));
  for (const user of testUsers) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    console.log(`${error ? 'FAILED ' : 'deleted'} ${user.email}${error ? `: ${error.message}` : ''}`);
  }
  console.log(`Removed ${testUsers.length} test login(s). Real users were not touched.`);
  process.exit(0);
}

let created = 0;
for (const account of TEST_ACCOUNTS) {
  const found = existing.get(account.email);
  if (found) {
    if (mode === 'reset') {
      const { error } = await admin.auth.admin.updateUserById(found.id, { password });
      console.log(`${error ? 'FAILED ' : 'reset  '} ${account.email}${error ? `: ${error.message}` : ''}`);
    } else {
      console.log(`exists  ${account.email}`);
    }
    continue;
  }
  const { error } = await admin.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    // Role is NOT taken from metadata (signup trigger forces 'student');
    // dev_seed.sql promotes the admin/warden test accounts by email.
    user_metadata: { full_name: account.fullName, ...(account.studentId ? { student_id: account.studentId } : {}) },
  });
  if (error) {
    console.log(`FAILED  ${account.email}: ${error.message}`);
  } else {
    created += 1;
    console.log(`created ${account.email} (${account.role})`);
  }
}
console.log(`Done: ${created} created. Next: run supabase/seed/dev_seed.sql in this project's SQL Editor.`);
