# Hostel Management System: Project Handoff

**Last updated:** 2026-10-21 (read-only release-readiness audit)
**Repository root:** `C:\Users\vvans\OneDrive\Desktop\SWE PROJECT`
**Application directory:** [`hostel-management/`](hostel-management/)
**Current branch:** `main`
**HEAD:** `0d274b2` (`Finished major functionalities`), level with `origin/main`. All 2026-10-20/21 work is **uncommitted** (see "Repository state").

> Read "Release-readiness status — 2026-10-21" first. Older sections are historical; where they conflict, the newest dated section wins. Verify against code before acting.

## Release-readiness status — 2026-10-21

**Verdict: not ready to deploy; ready for the next release-preparation stage** (commit the work, then a read-only production migration/config check). No production change has been made.

### Verification levels
- **Browser (owner-reported):** exercised by the project owner in a real browser against the **development** project `fdjixdmgcdljgncxsein`; reported in chat, not observed by the assistant (no browser tooling available).
- **Automated:** `npm test` (in-memory PostgreSQL via PGlite with the deployed baseline + migrations, and static UI/source checks) or the guarded live dev probe `npm run test:live-dev`.
- **Inspection:** read-only code/config review.
- **Not verified:** none of the above.

### Workflow coverage (development project)
| Workflow | Browser (owner) | Automated | Notes |
|---|---|---|---|
| Admin login, dashboard | Yes | — | |
| Admin student search; rooms directory, search, edit + persistence | Yes | Rooms rules: yes | Room create/edit/maintenance/capacity DB-tested |
| Admin hostel edit; create + delete new hostel (persists after refresh) | Yes | — | Seeded-hostel deletion intentionally blocked (see below) |
| Student registration → email confirmation → account linking → login | Yes | Linking logic: yes | Owner's own (non-seed) student linked after admin created the matching record |
| Password recovery (forgot/reset) | Yes | — | Supabase Auth flow; not automatable here |
| Resend confirmation email | Not verified | — | |
| Warden pending-student allocation + persistence | Yes | Yes (scope, full/maintenance/cross-hostel rejected) | |
| Admin allocate / transfer / release | Yes | Yes | |
| Complaints: submit → warden/admin status → student sees result | Yes | Yes + live dev probe 10/10 | Staff can change status only (migration 20261021120000) |
| Leave: submit → approve/reject with remark → student sees result | Yes | Yes | |
| Notices: admin + warden create, persist, delete; student visibility | Yes | Yes | |
| Role-specific notification bell (student, warden, admin) | Yes | — | |
| Modals: Escape, backdrop, save-lock, focus trap, focus restoration | Yes | Yes (`test:ui` 51: logic + all 11 call sites) | |
| `/admin/fees`, `/student/fees` → public homepage | Yes | Inspection | Fees out of scope |
| Session persistence after refresh; logout | Partially (admin login session) | — | Not explicitly tested for every role |
| Student cannot edit protected fields / link to another record; cross-hostel isolation | — | Yes (DB) + live dev read checks | |
| Responsive/mobile layout; screen-reader announcement | Not verified | — | |
| Landing page wording after QA fix | Not verified | — | |

### Hostel management (verified 2026-10-21)
- Creating a new hostel and deleting it works; the owner verified deletion persists after refresh.
- Seeded hostels **cannot be deleted by design** while they contain rooms: the Delete button is disabled when `room_count > 0` ([Hostels.tsx](hostel-management/src/pages/admin/Hostels.tsx), tooltip "Only hostels with no rooms or students can be deleted").
- A second safeguard in `deleteHostel` ([hostelsService.ts](hostel-management/src/services/hostelsService.ts)) refuses deletion when the hostel has rooms **or** associated students, including students waiting for allocation (`intended_hostel_id`). This protects occupied rooms (database `ON DELETE RESTRICT` on `students.room_id` would otherwise raise an error) and prevents waiting students from silently losing their intended hostel (`ON DELETE SET NULL`), plus cascade deletion of the hostel's rooms and notices.
- The delete handler targets the selected card's own hostel ID; the confirmation dialog displays that hostel's name (inspection).
- Dev data (read-only, 10-21): all three `[TEST]` hostels have rooms (8 / 5 / 2) and associated or waiting students, so all are protected.

### Known limitations (accepted for this release)
- **No room-deletion feature**, so an existing hostel with rooms cannot be emptied and deleted through the UI. Accepted limitation, not a defect; use reviewed SQL if ever required.
- The reason for the disabled hostel Delete button is shown only as a hover tooltip; a visible explanation would improve accessibility (LOW, optional).
- Fee management is out of scope (routes, pages and types removed).
- Admin "Add/Edit Student" may show a stale "not linked yet" warning immediately after save even though the database linked the account (the list badge shows the correct state) — LOW, reproduced on PGlite.
- Student "registration pending" message wording could be clearer for already-confirmed accounts — LOW.
- Complaints from students still awaiting allocation are visible to admins only — by design.
- Wardens can change room capacity in their own hostel at database level (no UI) — by design.
- No pagination (Supabase 1,000-row response cap); student search with commas/brackets unverified — LOW.
- A failed profile fetch during token refresh signs the user out — LOW.
- `hostel-management/README.md` is still the unmodified Vite template (does not describe the project) — LOW, documentation.

### Migration status
| Migration (repository) | Development `fdjixdmgcdljgncxsein` | Production |
|---|---|---|
| `initial_setup_review3.sql` (baseline) | Applied (owner-reported setup) | Applied (owner-reported 10-18) |
| `20261018130000_pending_allocation_intended_hostel.sql` | Applied (owner-reported setup) | Applied (owner-reported 10-18) |
| `20261019120000_allow_pending_student_room_allocation.sql` | Applied (owner-reported; warden allocation works in browser) | **Unknown** |
| `20261020120000_secure_student_account_linking.sql` | Applied (evidence: live linking + live probe) | **Unknown — believed not applied** |
| `20261021120000_complaint_workflow_integrity.sql` | Applied (evidence: live probe returned this migration's `42501` message) | **Unknown — believed not applied** |
| `supabase/archive/**` | Never run | Never run |
| `supabase/seed/**` | Dev only (marker-guarded) | **Never run** |

Rollbacks exist for 1912, 2012 and 2021 in `supabase/rollback/`. The read-only production status query is in the chat audit of 2026-10-21 (checks each migration, absence of the dev marker, duplicate student emails).

### Development seed status
- Last confirmed `seed:verify` (2026-10-21, after the live probe): all structural checks PASS (3 hostels, 15 rooms, 20 seeded students, 8 linked, occupancy matches allocations in every room, wardens assigned); complaint/leave totals 14/10 vs seeded 12/9 because of three owner-created "TEST —" records.
- `dev_cleanup_manual_test_records.sql` was prepared for those three records; **whether it has been run is unverified**. It is a one-off script with hard-coded dev record IDs and is **excluded from the intended commit** (it remains untracked locally).
- The owner has since created an additional legitimate student record (their own account), so the current student count may differ from the seeded 20. `seed:verify` assumes exact seed counts and was **not rerun**; do not delete the owner's record to make it pass.

### Repository state (2026-10-21, read-only)
- Branch `main`; 0 staged; 29 modified, 7 deleted, 32 untracked files; nothing committed since `0d274b2`.
- Deleted: `src/pages/{admin,student}/Fees.tsx` (intended) and five SQL files moved to `supabase/archive/` (verified byte-identical copies).
- Untracked: recovery pages, shared components/hooks, focus-trap helper, 2 migrations + 3 rollbacks, seed tooling, tests, `vercel.json`, `public/_redirects`, archive.
- Secrets: real values from `.env.local`, `.env.development.local` and `seed.env.local` were checked against all pending changes — **none present**; no JWT/`sb_secret_`/`sb_publishable_` patterns. Only `.env.example` (placeholders) is tracked; the three env files and `dist/` are git-ignored.

### Checks run 2026-10-21
| Command | Result |
|---|---|
| `npm test` | **PASS** — rls 59, seed 56, ui 51 passed; 0 failed (offline: PGlite + static checks) |
| `npx tsc -b --noEmit` | **PASS** |
| `npm run lint` | **PASS** — 0 errors; 5 pre-existing warnings (`set-state-in-effect` ×4, `exhaustive-deps` ×1 in Student Leave/Complaints, Warden Complaints/Dashboard) |
| `npm run build` | **PASS** — no warnings (app 58 kB, react-vendor 258 kB, supabase 214 kB) |
| `seed:accounts`, `test:live-dev`, `seed:verify` | **Skipped** — create users / temporarily mutate dev data / assume exact seed counts |

### Production readiness
- **Known (local evidence):** `.env.local` (production build env) holds a publishable key for a project that is not the dev project; no `VITE_DEMO_*`; build fails without Supabase env vars; `vercel.json` and `_redirects` route all paths to `index.html`; `engines.node >=20.19`.
- **Unknown (must be checked in production, read-only first):** migration status above; Authentication → Email "Confirm email" (must be ON — the linking security depends on it); Data API exposed schemas (must not include `private`; verified only in dev); Site URL and Redirect URLs (need the Vercel domain); Vercel project/env vars (not created).

### Next steps (in order)
1. Optional quick browser checks: resend confirmation, landing wording, mobile layout.
2. Commit the reviewed work (owner instruction required); Vercel deploys from Git.
3. Read-only production check: migration status query + existing-link audit + dashboard settings (Confirm email, exposed schemas).
4. With owner authorization, apply only missing migrations to production in order (`1912` → `2012` → `2021`); never `archive/` or `seed/`.
5. Create the Vercel project (root `hostel-management`, production env vars only), deploy, set Supabase Site URL / Redirect URLs, then smoke-test production.
6. Housekeeping: rotate the dev secret key; replace the template README.

## Status — 2026-10-20 (historical; superseded where the 2026-10-21 section differs)

### Verification levels used here
- **DB-tested**: executed in real PostgreSQL (PGlite, in-memory) with the deployed baseline + migrations, as simulated Supabase `authenticated` users, via `npm run test:db`. Not the live project.
- **Build-checked**: `tsc`, `oxlint`, `vite build` pass. Proves compilation only.
- **Live-verified**: exercised in the browser against the configured Supabase project. **Nothing from 2026-10-20 is live-verified yet.** *(Superseded 2026-10-21: most workflows were since browser-verified by the owner in dev — see "Workflow coverage".)*

### Migration state (what is applied to the live project)
| File | Live state | Notes |
|---|---|---|
| `initial_setup_review3.sql` | Applied (owner-reported) | This — not `schema.sql` — is the deployed baseline (`private.*` helpers, `private.handle_new_user()`). DB-tested: applies cleanly on a fresh DB. |
| `archive/migrations/20261018120000_harden_signup_role.sql` (moved 10-21) | Do **not** run | Targets `public.handle_new_user()`, which does not exist in the deployed baseline. Baseline already forces `student`. |
| `migrations/20261018130000_pending_allocation_intended_hostel.sql` | Applied (owner-reported) | DB-tested. |
| `migrations/20261019120000_allow_pending_student_room_allocation.sql` | **Unknown — awaiting Batch 0 SQL output** *(2026-10-21: applied in dev; production still unknown)* | Required for warden "Allocate Room" on pending students. DB-tested: applies cleanly before or after 20261020120000. |
| `archive/migrations/20261019140000_link_verified_student_accounts.sql` (moved 10-21) | **Cannot apply — superseded** | DB-tested: aborts with `function "public.handle_new_user()" does not exist` on the deployed baseline. Do not run; use 20261020120000. |
| `migrations/20261020120000_secure_student_account_linking.sql` | **Not applied — ready for review** | Idempotent; supersedes 20261019140000. DB-tested apply, rollback, re-apply. Rollback: `rollback/20261020120000_secure_student_account_linking.sql`. Applied in **dev** (owner-reported 10-20/21); production pending. |
| `migrations/20261021120000_complaint_workflow_integrity.sql` | **New 10-21** *(2026-10-21: applied in dev — live probe evidence; production unknown)* | Forces non-admin complaint inserts to `pending`; staff (non-owner, non-admin) may change only complaint status. DB-tested incl. re-run and rollback→reapply. Rollback: `rollback/20261021120000_complaint_workflow_integrity.sql`. |

### Security fix: student-record hijack (P0)
- **Problem (DB-tested on the current live schema):** any signed-in user could set their own `profiles.email`/`full_name` to another student's values; the admin Students page then linked that student's record to the attacker (`findStudentProfileId` matched by profile email + name, bypassing email confirmation and student ID).
- **Fix:** the browser never writes `students.user_id` ([studentsService.ts](hostel-management/src/services/studentsService.ts)). Migration 20261020120000 links only in the database when the Auth email is **confirmed**, exactly one record has that email, and the signup `student_id` matches. Linking runs on account creation/confirmation **and** when an admin creates a record (or fixes its email) after the student signed up. It also blocks non-admin profile email changes, limits students to editing phone/guardian/address on their own record, and rejects allocations into maintenance rooms.
- **Until 20261020120000 is applied**, admin-created records will not link at all (safe failure; the student sees "registration pending").
- **Hard requirement:** Supabase → Authentication → Providers → Email → **Confirm email = ON**. With it off, any unverified signup is treated as verified.

### Onboarding design (no admin-set passwords)
1. Admin creates the student record (email, student ID, intended hostel). No login is created.
2. Student registers at `/register` with the same email + student ID and their own password, then confirms the email.
3. The database links the account automatically (either order works). Lost password → `/forgot-password`.

### Frontend changes (build-checked, not live-verified)
- Password recovery: `/forgot-password`, `/reset-password` ([ForgotPassword.tsx](hostel-management/src/pages/ForgotPassword.tsx), [ResetPassword.tsx](hostel-management/src/pages/ResetPassword.tsx)); resend confirmation on Login ("Email not confirmed") and after Register; signup sends `emailRedirectTo=<origin>/login`.
- Student Profile and My Room now show the real linked record (were hardcoded "Aarav Sharma"); students can edit contact details.
- Warden Leave and Admin Leave: live list + approve/reject with remark ([LeaveReview.tsx](hostel-management/src/components/leave/LeaveReview.tsx)).
- Admin/Warden Notices: publish/list/delete ([NoticeManager.tsx](hostel-management/src/components/notices/NoticeManager.tsx)); wardens limited to assigned hostel, admins may post global notices.
- Admin Allocations: allocate / transfer / release across hostels (was static).
- Admin Rooms: edit floor, capacity, maintenance.
- Fees: **Fee management is out of scope for this release.** No fees table, service, page, route or type exists; `/admin/fees` and `/student/fees` were removed on 2026-10-21 (unknown paths redirect to `/`). Do not add fee functionality without a separate scope decision.
- SPA rewrites for hosting: `vercel.json`, `public/_redirects` (Netlify).

### Checks run 2026-10-20
| Check | Result |
|---|---|
| `npm run test:db` | **51 passed, 0 failed** (onboarding both orders, unconfirmed/mismatched not linked, hijack attempts blocked, role escalation blocked, student self-edit limits, warden scoping, allocation + capacity + transfer + maintenance, complaints, leave workflow, notices visibility) |
| Migration order tests | baseline+130+2012, +1912 before/after 2012, 2012 rollback+reapply: all apply |
| `npx tsc -p tsconfig.app.json --noEmit` | Pass |
| `npm run lint` | Pass; same 5 pre-existing hook warnings |
| `npm run build` | Pass; chunk-size warning (637 kB) |

### Required owner actions
1. Run the Batch 0 read-only SQL (in the chat) and share output → decide on 20261019120000.
2. Review then apply `20261020120000_secure_student_account_linking.sql` in SQL Editor as `postgres`.
3. Supabase Auth settings: Confirm email ON; URL Configuration → Site URL = deployed URL; Redirect URLs include `http://localhost:5173/**` and `https://<deployed-host>/**`.
4. Live smoke test (Section F matrix in chat / list below).

### Live smoke test (historical plan; dev browser testing done 2026-10-21, production smoke test still pending)
admin login + refresh persistence → create room → create student (intended hostel A) → student registers + confirms → student dashboard shows record → warden 1 allocates → student sees room → full-room rejection → complaint → warden resolves → leave → warden approves with remark → notices (warden hostel, admin global) → forgot/reset password → resend confirmation → cross-role URL redirects.

### Current priority (owner decision, 2026-10-20)
**Deployment and Git commit/push are paused.** First goal: complete, end-to-end-tested product using dummy data in a **new, separate development Supabase project** (owner chose this; the repo previously referenced only the production project). No dummy data goes into the existing project.

### Functionality matrix (2026-10-20)
Legend — **Code**: implemented (inspection). **DB**: page uses real Supabase queries. **AuthZ**: enforced by RLS/triggers, not just routing. **Auto**: covered by `npm run test:db` (real Postgres via PGlite, simulated users). **Browser**: exercised in a real browser against a configured project. "—" = not applicable.

| Area | Feature | Code | DB | CRUD | AuthZ | Auto | Browser | Blocker / note |
|---|---|---|---|---|---|---|---|---|
| Auth | Email/password login, role routing | Yes | Yes | — | Yes | Partial (role trigger) | Admin only (owner, 10-18) | Warden/student login untested |
| Auth | Session persists after refresh | Yes | Yes | — | — | No | No | Browser test |
| Auth | Student registration + email confirmation | Yes | Yes | C | Yes | Yes (link logic) | No | Needs dev project w/ Confirm email ON |
| Auth | Verified account linking (DB-only) | Yes | Yes | — | Yes | Yes (both orders, hijack blocked) | No | Migration 2012 unapplied |
| Auth | Forgot / reset password | Yes | Yes | U | Supabase Auth | No (Auth service) | No | Redirect URLs; real inbox needed |
| Auth | Resend confirmation | Yes | Yes | — | Supabase Auth | No | No | Real inbox needed |
| Auth | Logout | Yes | Yes | — | — | No | No | — |
| Admin | Dashboard counts | Yes | Yes | R | Yes | Indirect | No | — |
| Admin | Hostels: list/create | Yes | Yes | C R | Yes | Yes | Create: owner 10-18 | — |
| Admin | Hostels: edit + warden assignment | Yes (new) | Yes | U | Yes (admin-only update) | Policy tested indirectly | No | — |
| Admin | Hostels: delete (empty only) | Yes (new) | Yes | D | Yes; FK blocks occupied | No | No | Guard is client-side + FK |
| Admin | Rooms: create/edit/maintenance | Yes | Yes | C R U | Yes | Yes (capacity, maintenance, dup) | No | Delete not offered (by design) |
| Admin | Students: create/edit, linked badge | Yes | Yes | C R U | Yes | Yes | List load: owner 10-18 | Delete not offered |
| Admin | Allocations: allocate/transfer/release | Yes | Yes | U | Yes | Yes | No | — |
| Admin | Complaints: view + Start/Resolve | Yes (actions new) | Yes | R U | Yes | Yes | No | — |
| Admin | Leave: view + approve/reject + remark | Yes | Yes | R U | Yes (trigger sets approved_by) | Yes | No | — |
| Admin | Notices: publish global/hostel, delete | Yes | Yes | C R D | Yes | Yes | No | Edit not offered |
| Warden | Dashboard (assigned hostel) | Yes | Yes | R | Yes | Indirect | No | Resident count excludes pending |
| Warden | Students incl. pending queue | Yes | Yes | R | Yes (hostel-scoped) | Yes (cross-warden blocked) | No | — |
| Warden | Allocate pending student | Yes | Yes | U | Yes | Yes (full/maintenance/cross-hostel rejected) | No | Needs migration 1912 live |
| Warden | Rooms view | Yes | Yes | R | Yes | Yes | No | Read-only by design |
| Warden | Complaints Start/Resolve | Yes | Yes | R U | Yes | Yes | No | Complaints from *pending* students visible to admin only |
| Warden | Leave approve/reject + remark | Yes | Yes | R U | Yes | Yes | No | — |
| Warden | Notices for assigned hostel | Yes | Yes | C R D | Yes (no global) | Yes | No | — |
| Student | Dashboard / Profile / My Room (real data) | Yes | Yes | R, U contact | Yes (contact-only edits) | Yes | No | — |
| Student | Complaints submit + history | Yes | Yes | C R | Yes | Yes | No | — |
| Student | Leave submit + history + status/remark | Yes (silent-failure fix) | Yes | C R | Yes (forced pending) | Yes | No | — |
| Student | Notices (global + own hostel) | Yes | Yes | R | Yes | Yes | No | — |
| Fees | — | **Out of scope for this release** | — | — | — | — | — | Routes, placeholder pages and unused `Fee`/`FeeStatus` types removed 2026-10-21 |

**Nothing in the matrix is end-to-end verified yet.** Automated coverage is DB-level only; UI wiring is verified by inspection, typecheck and build. *(Superseded 2026-10-21: see "Workflow coverage" for owner-reported browser verification.)*

### Development environment and dummy data
Files (all in [`hostel-management/supabase/seed/`](hostel-management/supabase/seed/)):
| File | Purpose |
|---|---|
| `00_mark_dev_environment.sql` | Run once **only in the dev project**. Seed/cleanup/account script refuse to run without this marker. Marker table has RLS enabled with no policies (anon/authenticated denied even if granted); `public.dev_environment_marker()` is executable by `service_role` only. |
| `test-accounts.mjs` | Fictional logins (1 admin, 3 wardens, 8 students) at reserved `@hostel-test.example`; no passwords. |
| `create-test-accounts.mjs` | Creates/deletes those logins via Supabase **Auth Admin API** (email-confirmed). Requires `SEED_ALLOWED_PROJECT_REF` to match the URL. `--reset-passwords`, `--delete`. |
| `seed.env.example` | Template for git-ignored `seed.env.local` (service-role key lives only there, never `VITE_`). |
| `dev_seed.sql` | Idempotent dataset: 3 hostels (`[TEST] …`, Shivalik empty), 15 rooms (full/partial/empty/maintenance), 20 students `TST26-001…020` (14 allocated, 6 awaiting allocation, 8 linked, 12 unlinked), 12 complaints (6/3/3 pending/in-progress/resolved), 9 leave (4/3/2 pending/approved/rejected), 5 notices. Built-in consistency checks roll back on any mismatch. |
| `dev_cleanup_manual_test_records.sql` | **Excluded from the intended commit (2026-10-21)**; kept locally as an untracked audit trail. One-off, dev only: atomically deletes the 3 owner-created "TEST —" records (2 complaints, 1 leave) by exact ID + prefix; marker-guarded; rolls back unless exactly 2 + 1 rows are deleted. PGlite-validated (success, mismatch rollback, no-marker, re-run). REST-API script deliberately not used: it cannot roll back across two tables. |
| `dev_seed_cleanup.sql` | Removes only `[TEST]` hostels, `TST26-` students, test-domain records (and anything created inside test hostels). |

Automated: `node supabase/tests/seed.test.mjs` (part of `npm run test:db`) — **43 passed**: marker guard, exact counts, occupancy = allocations, warden/approver consistency, idempotent re-run, both login/seed orders, seeded-persona RLS, cleanup preserves non-test rows, reseed.

Dev project setup (owner, ~15 min):
1. Create a new Supabase project. Authentication → Providers → Email: **Confirm email ON**. URL Configuration: Site URL `http://localhost:5173`, Redirect URLs `http://localhost:5173/**`.
2. SQL Editor, in order: `supabase/initial_setup_review3.sql` → `migrations/20261018130000_…` → `migrations/20261019120000_…` → `migrations/20261020120000_…` → `migrations/20261021120000_…` → `seed/00_mark_dev_environment.sql`. (`supabase/migrations/` now contains only valid files, in apply order; old/broken SQL is in `supabase/archive/` with a README.)
3. Copy `supabase/seed/seed.env.example` → `seed.env.local`; fill dev URL, dev service-role key, dev project ref, a 12+ char test password. Run `npm run seed:accounts`.
4. SQL Editor: run `seed/dev_seed.sql`; expect summary `3 | 15 | 20 | 6 | 8 | 12 | 9 | 4`.
5. Create `hostel-management/.env.development.local` (git-ignored) with the dev project's `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. `npm run dev` now uses dev; the Login badge shows the dev project ref. `.env.local` (production) is unchanged and still used by `npm run build`.

### Final QA audit — 2026-10-21
Owner-reported browser results (dev project): admin, warden and student core workflows pass (see chat 10-21); student bell verified. Assistant could not perform browser testing (no browser automation available).

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | HIGH | Broken/stale SQL (`20261018120000`, `20261019140000`, `schema.sql`, proposal) inside `supabase/` could be applied by mistake | **Fixed**: moved to `supabase/archive/` + README |
| 2 | MEDIUM | Warden could rewrite a student's complaint title/description | **Fixed** in migration `20261021120000` (needs applying) |
| 3 | MEDIUM | Student could insert a complaint already `resolved`/`in_progress` | **Fixed** in migration `20261021120000` (needs applying) |
| 4 | MEDIUM | Modal lacked dialog semantics/focus handling; backdrop click never closed it (target was the backdrop, not the overlay) | **Fixed** in `Modal.tsx`; browser-verified by owner 2026-10-21 |
| 4b | LOW–MEDIUM | (10-21 follow-up) No Tab focus trap; focus lost to `<body>` when the trigger is removed; Student Leave Cancel not disabled while saving | **Fixed**: document-level Tab trap + focusin guard in `Modal.tsx` (pure logic in `src/components/ui/focusTrap.ts`); restore to trigger, else `<main>` (tabIndex -1), only when focus would otherwise be lost; Leave Cancel `disabled={saving}`. `npm run test:ui` 51 passed (unit + all-11-call-site checks). Browser-verified by owner 2026-10-21 |
| 5 | LOW | Landing page showed invented statistics (500+ students, 200+ rooms) | **Fixed**: replaced with true product facts |
| 6 | LOW | Single 642 kB JS bundle | **Fixed**: lazy routes + vendor chunks (app 57 kB; no size warning) |
| 7 | LOW | A failed profile fetch during token refresh signs the user out | Open (documented) |
| 8 | LOW | Wardens may change room capacity in own hostel (DB only); students may change own display name | By design (documented) |
| 9 | LOW | Complaints from students awaiting allocation are visible to admins only | By design (documented) |
| 10 | LOW | 5 pre-existing hook lint warnings; no pagination (1,000-row API cap) | Open |
| 11 | UNVERIFIED | Student search with commas/brackets may error | Open |
| 12 | LOW | Dev secret key appeared in session tool output | Rotate dev secret after testing |
| 13 | BLOCKER | Production config (migrations, Confirm email, Vercel env, redirect URLs) | Owner action at deploy |

Complaint workflow live probe — 2026-10-21 (`npm run test:live-dev`, dev project `fdjixdmgcdljgncxsein` only; guards: exact dev ref + dev marker; snapshot + verified restore path before probing): **10 PASS, 0 FAIL, 0 NOT RUN**. Assigned warden rejected for title/description/category (`42501`, workflow trigger) and student_id/room_id (`P0001`, baseline complaint integrity trigger); other-hostel warden updated 0 rows; legitimate status change succeeded; student insert with `resolved` stored as `pending`; target row restored to an identical snapshot; temporary complaint deleted (TST26-001 count 3 → 3). Local suite adds per-column warden tests (title, category, student_id, room_id): `rls.test.mjs` 59 passed. `seed:verify` afterwards: all structural checks pass; complaint/leave totals 14/10 vs seeded 12/9 because of three owner-created "TEST —" records from manual browser testing (pre-existing, not probe residue).

Verified boundaries (PGlite + live dev API read checks): no cross-student or cross-hostel reads; no role self-promotion or profile insertion; warden cannot move residents to another hostel, release them, or reassign hostels; anon denied on tables; `private` schema not exposed (live dev: `PGRST106`); dev marker denied to anon.

### Deployment (chosen: Vercel + existing Supabase project) — PAUSED
- Vercel project settings: Root Directory `hostel-management`; Framework Preset `Vite`; Build `npm run build`; Output `dist`; Install `npm install`; Node 22.x (package.json `engines.node >=20.19`).
- Vercel env vars (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon/publishable key only; never service-role). Do **not** set `VITE_DEMO_*`.
- `vite.config.ts` now fails the build if either Supabase variable is missing, so a misconfigured deploy can never ship offline demo mode (which accepts any password). Verified locally: build passes with env, fails without.
- `vercel.json` rewrites every non-file path to `index.html` (covers `/login`, `/register`, `/forgot-password`, `/reset-password`, `/student/*`, `/warden/*`, `/admin/*`).
- After the first deploy: Supabase → Authentication → URL Configuration → Site URL = `https://<project>.vercel.app`; Redirect URLs add `https://<project>.vercel.app/**` and `http://localhost:5173/**`.

### Migration 20261020120000 review notes (2026-10-20)
- Trigger entry points (`handle_verified_student_auth_link`, `handle_student_record_link`) catch errors and emit a WARNING, so a linking problem can never block sign-up or email confirmation; the record simply stays unlinked.
- Replaces two existing functions in place: `private.prevent_student_identity_reassignment()` and `private.check_student_room_allocation()` (baseline body + maintenance check). Does not modify any RLS policy, table, column, or constraint other than adding unique index `uq_students_normalized_email`.
- Data changes: links eligible unlinked records; syncs student profile email to verified auth email. Never changes already-linked records.
- Does not touch pending-allocation logic; 20261019120000 is independent and DB-tested in either order.
- Supabase SQL Editor "destructive operation" warning was caused only by six `DROP TRIGGER IF EXISTS` lines (drop-then-recreate of the migration's own triggers). Replaced with `CREATE OR REPLACE TRIGGER` (PG14+); the file now contains no drop/delete/truncate keyword. Row-level before/after diff on PGlite with mixed data: 0 rows deleted or added in any table; only the one eligible unlinked student received `user_id`. Tests 51 + 47 pass; re-run and rollback→reapply pass.

## Latest verified session status — 2026-10-18

### User-verified in Supabase/browser

- Admin profile promotion and sign-in succeeded; the shared email/password login routes the admin to the Admin Dashboard. Role selection is not offered at login; routing follows the database-assigned `public.profiles.role`.
- Deployed signup handling is `private.handle_new_user()` and assigns new profiles the `student` role. `trg_prevent_role_escalation` invokes `private.prevent_profile_role_escalation()`. The deployed `students_select_scoped` policy uses private helper functions. Do not rerun the signup-role migration without rechecking deployed function and trigger definitions.
- `20261018130000_pending_allocation_intended_hostel.sql` was applied. The `students_intended_hostel_id_fkey` relationship and `students_select_scoped` policy were verified. The migration did not backfill existing students.
- The ambiguous student-to-hostel embeds were fixed with explicit FK hints and distinct `actual_hostel` / `intended_hostel` aliases. Admin → Students loaded afterward without that relationship error.
- The former four-card mock hostel directory was replaced with Supabase-backed reads and Add Hostel persistence. `hostel A` (ID `02c59821-8216-405c-8fff-10d47ff2cf53`) was confirmed in Supabase and appeared in the directory after refresh. It is assigned to an existing warden profile; the confirmed assignment was queried in Supabase. Its `warden_id` is NULL no longer.
- A warden account was created through normal signup/email confirmation and its existing profile was promoted to `warden` in a targeted SQL transaction. Supabase confirmed the profile name `warden 1` and the assignment to `hostel A`. Account email and UUID are intentionally omitted here.

### Repository/check status

- Student management code connects the admin and warden student pages through `studentsService`; room allocation remains a separate, unimplemented UI workflow. Student admission and the warden pending-allocation queue have not yet been verified end to end.
- The hostel directory calculates room/resident counts from Supabase room and allocation rows. A follow-up fix preserves hostels when a supporting statistics query fails and reports that query's error separately.
- Recent `npm run lint`, `npm run build`, and `git diff --check` runs passed. Existing Oxlint hook warnings remain in Student Complaints, Student Leave, and Warden Dashboard; Vite reports a chunk larger than 500 kB.

### Still unverified

- The warden account has not been used in the browser to verify Warden Dashboard routing.
- Student admission → intended-hostel persistence → warden pending-allocation visibility is the next test. Actual room allocation/capacity rejection, complaints, leave decisions, notices, fees, and the complete role/RLS matrix remain unverified.
- The successful hostel and student observations above are user-verified live facts; no claim is made that all workflows or deployed policies have been independently tested by the assistant.

### Next exact task

Test student admission → pending allocation without assigning a room:

1. Sign in as admin and open Admin → All Students → Add Student.
2. Create one identifiable student with `hostel A` as the intended hostel and leave room allocation empty.
3. Refresh Admin → Students and confirm the student persists with that intended hostel.
4. Sign in as `warden 1`; confirm Warden Dashboard routing, then open Warden → Students → Pending Allocation.
5. Confirm the student appears. If any step fails, capture the exact browser/Supabase error and fix only that issue; do not make speculative schema/RLS changes.

Room allocation is a later task. It must use actual room records and enforce capacity and access control.

## A. Project Overview

Hostel Management System is a React web application for a college hostel operation. Its intended users are administrators, wardens, and students. The intended scope is:

- Administer hostels, rooms, students, and room allocations.
- Let students view their profile and room, submit complaints, submit leave requests, and read notices.
- Let wardens review complaints and leave requests and publish or manage notices.
- Let administrators oversee the full operation and dashboard metrics.
- Persist the workflows in Supabase PostgreSQL with Supabase Authentication and Row Level Security (RLS).

The present UI is an MVP-oriented dashboard with public landing/login screens and role-specific pages. Admin login and hostel creation/listing, plus admin/warden student directory code, now use Supabase-backed paths. The full demonstration workflow (student admission through allocation, student requests, warden decisions, and all live dashboard metrics) is still **not implemented or verified end to end**; several pages continue to use hardcoded arrays.

The four-day objective is therefore integration and reliability, not a visual rewrite. Existing routes, layouts, UI primitives, service modules, and schema should be reused while wiring real data and verifying permissions.

## B. Technology Stack and Architecture

### Verified stack

| Area | Verified implementation |
|---|---|
| UI | React `^19.2.8`, React DOM `^19.2.8` |
| Language | TypeScript `~6.0.2` |
| Build/dev | Vite `^8.3.0`, `@vitejs/plugin-react` |
| Styling | Tailwind CSS `^4.3.3` through `@tailwindcss/vite`; substantial utility classes in source |
| Routing | `react-router-dom` `^7.18.4` |
| Icons | `lucide-react` `^1.49.0` |
| Data/auth client | `@supabase/supabase-js` `^2.117.2` |
| Lint | Oxlint `^1.81.0`, configured in [`hostel-management/.oxlintrc.json`](hostel-management/.oxlintrc.json) |
| Database target | Supabase PostgreSQL. *(Corrected 2026-10-21: the deployed baseline is [`hostel-management/supabase/initial_setup_review3.sql`](hostel-management/supabase/initial_setup_review3.sql) plus [`supabase/migrations/`](hostel-management/supabase/migrations/); the original audit cited `schema.sql`, now archived at [`supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql).)* |
| Tests | *(2026-10-18 audit: none found.)* **Corrected 2026-10-21:** `npm test` runs `test:db` (PGlite in-memory PostgreSQL: [`supabase/tests/rls.test.mjs`](hostel-management/supabase/tests/rls.test.mjs), [`supabase/tests/seed.test.mjs`](hostel-management/supabase/tests/seed.test.mjs)) and `test:ui` ([`tests/ui/modal-focus.test.mjs`](hostel-management/tests/ui/modal-focus.test.mjs)); no Vitest/Jest/Playwright/Cypress |

The package lock is present. The package scripts were `dev`, `build`, `lint`, and `preview` at the 2026-10-18 audit; *as of 2026-10-21* [`hostel-management/package.json`](hostel-management/package.json) also has `test`, `test:db`, `test:ui`, `test:live-dev` (dev project only; temporarily changes and restores a dev record), `seed:accounts` and `seed:verify` (dev project only). There is no root package script; commands must run from `hostel-management/`.

### Application flow

[`hostel-management/src/main.tsx`](hostel-management/src/main.tsx) mounts [`App.tsx`](hostel-management/src/App.tsx). `App` wraps the router in `AuthProvider`, exposes public routes, and places student, warden, and admin route groups inside `ProtectedRoute` and `DashboardLayout`.

The intended data flow is:

1. Browser reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in [`src/lib/supabase.ts`](hostel-management/src/lib/supabase.ts).
2. [`AuthContext.tsx`](hostel-management/src/context/AuthContext.tsx) obtains a Supabase session and loads `public.profiles`, or enters explicit local demo mode when configuration is absent/placeholder.
3. Pages should call the modules exported by [`src/services/index.ts`](hostel-management/src/services/index.ts).
4. Services call Supabase tables when configured and otherwise use process-local mock arrays.
5. The database schema is intended to enforce role access, student ownership, and room capacity independently of the UI.

The application now has a verified live Supabase auth path for the admin and live-backed hostel and student-directory code. The owner's live checks confirm the relevant deployed tables and student migration are present. Other pages still contain mock data, and the local full schema is not a complete representation of deployed state.

## C. Repository Map

| Path | Responsibility | Normal future change location |
|---|---|---|
| [`hostel-management/package.json`](hostel-management/package.json) | Dependencies and scripts | Add only approved dependencies or scripts here |
| [`hostel-management/src/App.tsx`](hostel-management/src/App.tsx) | Route registration and role route groups | Add/change routes only when a page exists and access rules are clear |
| [`hostel-management/src/pages/`](hostel-management/src/pages/) | Landing, login, and role-specific screens | Wire page loading, forms, mutations, and empty/error states here |
| [`hostel-management/src/components/layout/`](hostel-management/src/components/layout/) | Auth/dashboard layout, header, sidebar, page headers | Shared navigation and shell behavior |
| [`hostel-management/src/components/ui/`](hostel-management/src/components/ui/) | Button, form, table, modal, badge, card, loading, and empty-state primitives | Reuse these before adding new UI primitives |
| [`hostel-management/src/context/`](hostel-management/src/context/) | Auth provider, context definition, and hook | Session/profile/role behavior |
| [`hostel-management/src/lib/supabase.ts`](hostel-management/src/lib/supabase.ts) | Supabase client and configuration detection | Environment/client behavior; never put secrets here |
| [`hostel-management/src/services/`](hostel-management/src/services/) | Supabase CRUD wrappers plus offline mock fallback | Database operations and error mapping |
| [`hostel-management/src/types/index.ts`](hostel-management/src/types/index.ts) | Shared domain and dashboard types | Keep types aligned with the SQL schema |
| [`hostel-management/supabase/initial_setup_review3.sql`](hostel-management/supabase/initial_setup_review3.sql) | **Deployed baseline** (corrected 2026-10-21): tables, `private.*` RLS helpers, triggers, 27 RLS policies; for fresh projects only (aborts if tables exist) | Never rerun on an existing project |
| [`hostel-management/supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql) | Archived 2026-10-21 (was `supabase/schema.sql`): outdated original schema with broad warden policies; **not** the baseline | Do not run; history only |
| [`hostel-management/supabase/migrations/`](hostel-management/supabase/migrations/) | *(As of 2026-10-21)* Only valid migrations, in apply order: `20261018130000`, `20261019120000`, `20261020120000`, `20261021120000` | Check status read-only before applying; `20261019120000` cannot be re-run once applied or rolled back (its precheck aborts safely) |
| [`hostel-management/supabase/rollback/`](hostel-management/supabase/rollback/) | Rollbacks for `20261019120000`, `20261020120000`, `20261021120000` | Roll back in reverse order; review before use |
| [`hostel-management/supabase/archive/`](hostel-management/supabase/archive/) | Archived SQL (see its README): broken `20261018120000` / `20261019140000` (+ rollback), `schema.sql`, the 2026-10-18 proposal | **Never run** |
| [`hostel-management/supabase/seed/`](hostel-management/supabase/seed/) | Dev-only seed/cleanup tooling, guarded by the dev marker | Never run in production |
| [`hostel-management/supabase/tests/`](hostel-management/supabase/tests/), [`hostel-management/tests/ui/`](hostel-management/tests/ui/) | Automated tests (`npm test`) and the dev-only live probe | Offline except `test:live-dev` |
| [`hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql) | Archived 2026-10-21: unapplied 2026-10-18 hardening proposal, superseded by `initial_setup_review3.sql` and the migrations | Do not run; history only |
| [`hostel-management/.env.example`](hostel-management/.env.example) | Placeholder environment variable names | Document names only, never values |
| [`hostel-management/.gitignore`](hostel-management/.gitignore) and [`.gitignore`](.gitignore) | Ignore rules for secrets, dependencies, output, and editor files | Preserve secret/build exclusions |
| [`hostel-management/vite.config.ts`](hostel-management/vite.config.ts) | Vite and Tailwind plugin configuration | Build configuration |
| [`hostel-management/tsconfig*.json`](hostel-management/) | TypeScript project configuration | Type checking/compiler behavior |
| [`HOSTEL_PROJECT_HANDOFF.md`](HOSTEL_PROJECT_HANDOFF.md) | This maintained project state and next-task tracker | Update after every meaningful session |

No application test directory, CI workflow, or root-level application runtime existed in the 2026-10-18 audited tree. *(Corrected 2026-10-21: test directories now exist (see the Tests row in section B); there is still no CI workflow or root-level runtime.)* Versioned SQL migrations are present under `hostel-management/supabase/migrations/`; `hostel-management/supabase/.temp/` is local Supabase tooling state and should not be treated as the applied database schema.

## D. Current Implementation Inventory

Status meanings are intentionally strict. A feature is `Complete` only when its relevant acceptance criteria are implemented and verified. UI presence alone is not completion.

| Feature | Status | Relevant files | Current behaviour | Missing work | Verification |
|---|---|---|---|---|---|
| Public landing page | Partial | [`src/pages/Landing.tsx`](hostel-management/src/pages/Landing.tsx), [`src/App.tsx`](hostel-management/src/App.tsx) | Renders marketing/entry UI and navigates to login. | Validate links and final demo copy. | Build passed; browser behavior not run. |
| Login/logout | Partial | [`src/pages/Login.tsx`](hostel-management/src/pages/Login.tsx), [`src/context/AuthContext.tsx`](hostel-management/src/context/AuthContext.tsx), [`src/components/layout/Header.tsx`](hostel-management/src/components/layout/Header.tsx) | One email/password form serves all roles; the authenticated profile's database role determines redirect. Admin login and Admin Dashboard routing were verified in browser. Local mode still accepts role-inferred demo credentials without password validation. | Verify warden login/routing and student login/session behavior; demo mode is not real authentication. | Admin verified by project owner; warden browser routing untested. |
| Session/profile loading | Partial | [`src/context/AuthContext.tsx`](hostel-management/src/context/AuthContext.tsx), [`src/context/authContextDef.ts`](hostel-management/src/context/authContextDef.ts), [`src/context/useAuth.ts`](hostel-management/src/context/useAuth.ts) | Gets session and selects `profiles` in configured mode; validated `profiles.role` is used for redirects. | Verify warden/student sessions and the full role matrix. | Admin profile/session routing owner-verified; other roles pending. |
| Role-protected routes | Partial | [`src/App.tsx`](hostel-management/src/App.tsx), [`src/components/auth/ProtectedRoute.tsx`](hostel-management/src/components/auth/ProtectedRoute.tsx) | Redirects unauthenticated and role-less users; mismatched known roles redirect to their role home. | Verify each route with real accounts. Frontend guards cannot replace RLS. | Admin route browser-verified; warden route untested. |
| Student routes/pages | Partial | [`src/pages/student/`](hostel-management/src/pages/) | Student pages still include hardcoded/mock data; student admission and pending-allocation visibility are not yet verified end to end. | Connect remaining profile/room/complaint/leave/notice pages; connect allocation separately and verify persistence. | Build passed; student workflow pending. |
| Warden routes/pages | Partial | [`src/pages/warden/`](hostel-management/src/pages/warden/) | Warden student listing/search calls Supabase services and filters by hostels assigned to the current account; other workflow pages remain incomplete. | Verify warden sign-in and pending-allocation visibility; implement complaint/leave decisions and remaining pages. | Student-page code inspected; role login and pending queue untested. |
| Admin routes/pages | Partial | [`src/pages/admin/`](hostel-management/src/pages/admin/) | Admin Hostel Directory/Add Hostel and Student Management use Supabase services; several other pages remain presentation-only or partially connected. | Verify student admission, implement room allocation/status operations, and connect remaining notices/complaints/leave/fee pages. | Hostel create+refresh owner-verified; full CRUD/workflow matrix incomplete. |
| Shared UI/layout | Partial | [`src/components/layout/`](hostel-management/src/components/layout/), [`src/components/ui/`](hostel-management/src/components/ui/) | Reusable shell and UI primitives exist and compile. | Validate modal accessibility/backdrop behavior and keyboard interaction while wiring forms. | Build/lint passed; no browser accessibility check. |
| Student management | Partial | [`src/pages/admin/Students.tsx`](hostel-management/src/pages/admin/Students.tsx), [`src/pages/warden/Students.tsx`](hostel-management/src/pages/warden/Students.tsx), [`src/services/studentsService.ts`](hostel-management/src/services/studentsService.ts) | Admin listing/search/create/edit and warden listing/search call Supabase services; distinct explicit hostel FK aliases are in use. | Verify student record persistence and intended-hostel visibility in the warden's pending queue. Auth account creation remains separate; room allocation is not connected to this form. | Admin Students browser page loaded after FK fix; admission/queue workflow not run. |
| Hostel management | Partial | [`src/pages/admin/Hostels.tsx`](hostel-management/src/pages/admin/Hostels.tsx), [`src/services/hostelsService.ts`](hostel-management/src/services/hostelsService.ts) | Directory and Add Hostel use live Supabase data; warden choices come from existing `profiles` rows with role `warden`; counts use room/allocation data. No mock hostel fallback in this service. | Continue live RLS/error testing; room and student management are separate workflows. | Owner confirmed create, database row, assignment, and appearance after browser refresh. |
| Room management | Partial | [`src/pages/admin/Rooms.tsx`](hostel-management/src/pages/admin/Rooms.tsx), [`src/pages/warden/Rooms.tsx`](hostel-management/src/pages/warden/Rooms.tsx), [`src/services/roomsService.ts`](hostel-management/src/services/roomsService.ts) | Static room views; service has list/read/create/update. | Connect room CRUD and maintenance/status controls; validate hostel and capacity inputs. | Build passed; no DB operation test. |
| Room allocation/capacity | Partial | [`src/pages/admin/Allocations.tsx`](hostel-management/src/pages/admin/Allocations.tsx), [`src/services/studentsService.ts`](hostel-management/src/services/studentsService.ts), [`supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql) | Service exposes `assignRoom`; SQL trigger validates room existence/capacity and synchronizes occupancy. UI allocation is not connected. | Implement allocation/transfer form, surface database errors, test full-room rejection and occupancy updates. | Trigger exists locally; live trigger and UI not verified. |
| Complaints | Partial | [`src/pages/student/Complaints.tsx`](hostel-management/src/pages/student/Complaints.tsx), [`src/pages/warden/Complaints.tsx`](hostel-management/src/pages/warden/Complaints.tsx), [`src/pages/admin/Complaints.tsx`](hostel-management/src/pages/admin/Complaints.tsx), [`src/services/complaintsService.ts`](hostel-management/src/services/complaintsService.ts) | Static complaint cards/tables; service supports list/read/create/status update. | Connect student submission and warden/admin status changes; verify ownership and scope. | No page service callers; no persistence test. |
| Leave requests | Partial | [`src/pages/student/Leave.tsx`](hostel-management/src/pages/student/Leave.tsx), [`src/pages/warden/Leave.tsx`](hostel-management/src/pages/warden/Leave.tsx), [`src/pages/admin/Leave.tsx`](hostel-management/src/pages/admin/Leave.tsx), [`src/services/leaveService.ts`](hostel-management/src/services/leaveService.ts) | Static requests; Approve/Reject buttons have no handlers; service supports create/status update. | Connect forms/decisions, remarks, dates, `approved_by`, and student refresh visibility. | No page service callers; no persistence test. |
| Notices | Partial | [`src/pages/student/Notices.tsx`](hostel-management/src/pages/student/Notices.tsx), [`src/pages/warden/Notices.tsx`](hostel-management/src/pages/warden/Notices.tsx), [`src/pages/admin/Notices.tsx`](hostel-management/src/pages/admin/Notices.tsx), [`src/services/noticesService.ts`](hostel-management/src/services/noticesService.ts) | Static notices; service supports list/create/delete. | Connect publish/delete/list and hostel visibility; secure author identity. | No page service callers; no live test. |
| Fees | Out of scope (this release) | — (removed 2026-10-21) | No fee feature exists. | None for this release. | Routes, pages and types removed; see "Latest status". |
| Dashboards/statistics | Partial | [`src/pages/admin/Dashboard.tsx`](hostel-management/src/pages/admin/Dashboard.tsx), [`src/pages/student/Dashboard.tsx`](hostel-management/src/pages/student/Dashboard.tsx), [`src/pages/warden/Dashboard.tsx`](hostel-management/src/pages/warden/Dashboard.tsx) | All three dashboard files call Supabase services when configured; real role-specific metrics and RLS visibility are not comprehensively verified. | Test with each live role; audit any remaining hardcoded activity/data and correct scoped queries. | Admin login route verified, dashboard data/RLS matrix not verified. |
| Database integration | Partial | [`supabase/migrations/`](hostel-management/supabase/migrations/), [`src/lib/supabase.ts`](hostel-management/src/lib/supabase.ts), [`src/services/`](hostel-management/src/services/) | Owner verified deployed auth role hardening, student relationship migration/policy, hostel records, and admin-hostel persistence. Other modules and the full authorization matrix remain incomplete. | Continue the student admission/pending-allocation test, then wire and verify remaining modules without weakening RLS. | Live facts recorded from owner-provided Supabase/browser results; not independently queried in this handoff. |

## E. Database Reference

### Local SQL definition

> **Correction 2026-10-21:** the deployed baseline is [`supabase/initial_setup_review3.sql`](hostel-management/supabase/initial_setup_review3.sql) plus `supabase/migrations/`. The paragraph and tables below describe the original `schema.sql` (now archived) and are kept for history only.

[`hostel-management/supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql) is the local baseline definition/seed script, not proof of deployed state. Versioned migrations are also present; the owner reports the signup-role hardening and pending-allocation migration states described in the latest session entry. No complete applied-schema export was reviewed here.

Tables defined with `CREATE TABLE IF NOT EXISTS`:

| Table | Purpose and important columns | Keys/relationships and constraints |
|---|---|---|
| `public.profiles` | Auth-linked identity: `id UUID`, `full_name TEXT`, `email TEXT`, `role TEXT`, timestamps | PK/FK `id -> auth.users(id)` with cascade; role check `student`, `warden`, `admin`; full name/email required |
| `public.hostels` | Hostel directory: `id`, unique `name`, `type`, `warden_id`, `total_rooms`, `address`, timestamps | `warden_id -> profiles(id)` set null; type `boys/girls`; nonnegative room count |
| `public.rooms` | Room inventory: `id`, `hostel_id`, `room_number`, `floor`, `capacity`, `current_occupants`, `status`, timestamps | `hostel_id -> hostels(id)` cascade; unique `(hostel_id, room_number)`; capacity positive; occupants between zero and capacity; status `available/full/maintenance` |
| `public.students` | Student record and allocation: `id`, optional unique `user_id`, `student_id`, name/email/contact/academic data, `hostel_id`, `room_id`, guardian/address, timestamps | `user_id -> profiles(id)` unique/cascade; hostel/room FKs set null; student ID unique; year 1-5 |
| `public.complaints` | Student maintenance tickets: `id`, `student_id`, optional `room_id`, title/category/description/status, timestamps | Student FK cascade; room FK set null; category and status checks |
| `public.leave_requests` | Leave workflow: `id`, `student_id`, reason/destination/dates/emergency contact/message/status/remark/approved_by, timestamps | Student FK cascade; approver FK to profiles set null; status check; `end_date >= start_date` |
| `public.notices` | Broadcast notices: `id`, title/description/priority, `posted_by`, optional `hostel_id`, timestamps | Poster FK to profiles set null; hostel FK cascade; priority `low/medium/high` |

Indexes exist for room hostel, student user/room/hostel, complaint student/status, leave student/status, notice hostel/created date.

### Functions and triggers

- `check_student_room_allocation()` is a `SECURITY DEFINER` before insert/update-of-room trigger on `students`. It confirms a target room exists, overwrites `students.hostel_id` from the room, counts occupants excluding the current row on update, and raises if capacity would be exceeded.
- `sync_room_occupancy()` is a `SECURITY DEFINER` after insert/update-of-room/delete trigger on `students`. It recalculates `rooms.current_occupants` and changes status between `available` and `full`, preserving `maintenance`.
- In the local baseline, `handle_new_user()` inserts/updates a profile using metadata, including a role fallback to `student`; the owner reports that deployed `private.handle_new_user()` now forces every new profile to `student`.
- The local baseline's `prevent_profile_role_escalation()`/policies are not proof of deployed behavior. The owner reports deployed trigger `trg_prevent_role_escalation` calls `private.prevent_profile_role_escalation()`; do not apply or rerun a migration without rechecking deployed definitions.
- Helper functions `get_auth_role()`, `is_admin()`, `is_warden()`, `get_current_student_id()`, and `is_warden_for_hostel()` are `STABLE SECURITY DEFINER` helpers intended to avoid recursive RLS checks.

### Local RLS policies

RLS is enabled on all seven tables. The local policy intent is:

- Profiles: all authenticated users can select; users can update themselves and admins can update profiles; users/admins can insert profiles.
- Hostels: authenticated select; admins insert/delete; admins or assigned wardens update.
- Rooms: authenticated select; admins or assigned wardens insert/update; admins delete.
- Students: admins/wardens/self/roommates select; admins insert/delete; admins, assigned wardens, or self update with a self-update room/user restriction.
- Complaints: admins/wardens/current student select; admins/current student insert; admins/wardens or a student with a pending complaint update; admins or owner of pending complaint delete.
- Leave: admins/wardens/current student select/insert; admins/wardens or owner of pending request update; admins or owner of pending request delete.
- Notices: all authenticated select; admins/wardens insert; admins or author update/delete.

Important local-policy risks to verify before treating the schema as secure:

1. Authenticated profile insertion permits `auth.uid() = id` without restricting the inserted role, while the auth trigger trusts `raw_user_meta_data.role`. A user may be able to self-create an elevated profile depending on the exact live trigger/policy behavior.
2. Notice insert checks role but not `posted_by = auth.uid()`, so a caller can supply another author ID unless the live schema differs.
3. Warden policies use `is_warden()` broadly for students, complaints, and leave, rather than consistently restricting a warden to their assigned hostel.
4. Profiles, hostels, and rooms have broad authenticated read policies. This may be intentional for the MVP, but it exposes more records than a least-privilege design.
5. The student roommate policy contains a subquery over `students`; the live behavior should be tested for recursion/policy interaction.

### Live-state boundary

The original 2026-10-18 connection attempt returned `PGRST205` for `public.hostels`; that observation is historical and is superseded by the owner's later confirmation that the table exists and contains `hostel A`. Per the owner, the deployed signup trigger/function, role-protection trigger/function, and `students_select_scoped` policy were inspected and confirmed as summarized in the latest status above. The intended-hostel migration was applied and verified. The full deployed schema and RLS matrix are still **not independently audited or exhaustively tested**. The separate [`proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql) proposal remains distinct; do not assume it was applied.

### Proposed security hardening migration

The review-only file [`proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql) assumes the seven base tables and the original helper-function signatures already exist. It begins a transaction, checks table/function preconditions, inventories policies, aborts on unexpected policy names, creates private policy helpers, revokes direct execution from old public helpers, replaces all 27 known policies, recreates relevant triggers, and commits only the DDL changes if manually executed. It does not create/drop application tables, delete rows, update existing rows, seed hostels, repair occupancy, reset data, or change auth users.

It proposes these changes:

- New auth users always receive `student`; signup metadata cannot create an admin or warden. Admin/warden promotion becomes an explicit trusted SQL Editor/service-role operation after the account exists.
- Policy-only `SECURITY DEFINER` helpers are created in `private`, removed from the anonymous/public execution grants, and granted to `authenticated` because PostgreSQL RLS evaluation needs EXECUTE. The private schema must not be exposed through PostgREST; otherwise authenticated users could call those helpers as RPCs.
- Trigger-only functions receive no client EXECUTE grant. Existing public helper/trigger functions are explicitly revoked from `PUBLIC`, `anon`, and `authenticated` after policies/triggers are rewired to private functions.
- Every known policy from `schema.sql`, plus names from the earlier proposal, is dropped before the final 27 policies are created. Unexpected live policies cause the migration to abort for manual review.
- The self-insert profile policy is removed. Authenticated profile inserts require an existing admin; the auth trigger remains `SECURITY DEFINER` for its controlled profile creation.
- Role changes remain blocked for browser users unless the current user is an admin. `auth.uid() IS NULL` is treated as trusted server-side execution for bootstrap/promotion, so the owner must protect SQL Editor/service-role access.
- Profile, hostel, room, and student reads are scoped. Students see their own student/profile record and their assigned hostel/rooms; wardens see records in hostels where `hostels.warden_id = auth.uid()`; admins retain oversight.
- Complaints and leave requests are scoped by owner, admin, or the warden assigned to the student’s hostel. Student complaint inserts can reference only the student’s assigned room.
- Non-admin authenticated users cannot reassign a student identity or transfer complaint/leave ownership through updates.
- A before-insert notice trigger overwrites client-supplied `posted_by` with `auth.uid()` for authenticated requests. Notice policies require authenticated authorship and assigned-hostel scope for wardens.
- Global notices remain visible to all authenticated users. Hostel-specific notices are visible only to admins, the assigned warden, or students assigned to that hostel. Wardens may manage only notices for their assigned hostel or global notices.
- Room allocation locks the target room row during the capacity check; transfers lock old/new rooms in UUID order to reduce swap deadlocks. A NULL room assignment clears `hostel_id`, and the existing-room occupancy trigger recalculates the old room.
- Room occupancy is derived from `students.room_id`. A room trigger recalculates `current_occupants` and `status`, rejects capacity below existing occupancy, and preserves `maintenance`. Existing inconsistent rows are only reported by a preflight query; they are not repaired automatically.
- Leave workflow triggers prevent students from changing approval status, remarks, or `approved_by`; authenticated admin/warden approvals set `approved_by` from `auth.uid()` and cannot preserve a forged client value.

Potential impact and assumptions:

- Existing users keep their current roles and existing rows are not rewritten. Existing profiles that were incorrectly elevated require a separately approved audit/remediation operation.
- Existing authenticated students may lose access to roommate records, other profiles, unrelated hostels/rooms, complaints, and leave requests. This is intentional least-privilege behavior and must be tested against the MVP UI.
- Existing wardens may lose cross-hostel visibility and operations unless each hostel has the correct `warden_id`.
- The private schema is not automatically guaranteed to be absent from PostgREST exposure. The migration includes a setting query, but the Supabase API settings must be checked manually before applying it.
- The current frontend notice service supplies `posted_by`; the trigger makes the authenticated identity authoritative, but the service/UI should later stop treating that field as user-controlled.
- The current application has no admin/warden provisioning workflow. Manual trusted promotion is therefore required before real role-based testing.
- The base schema must exist before this hardening file can run. Because the live project currently reports missing `public.hostels`, the owner must first review how the base schema will be applied; this proposal does not apply it.
- The proposal has not been executed or validated by PostgreSQL in this environment. Live RLS behavior remains **Not verified**.
- PostgreSQL syntax, trigger ordering, concurrent transfer behavior, and function privilege behavior still require validation in a disposable/staging database or an approved SQL Editor session.
- Final review additionally requires validating authenticated leave INSERT/UPDATE transitions, complaint room association, and the executable PostgREST exposure gate.

## F. Authentication and Authorisation

When both non-placeholder `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist, [`src/lib/supabase.ts`](hostel-management/src/lib/supabase.ts) creates a Supabase client with session persistence, token refresh, and URL session detection. [`AuthContext.tsx`](hostel-management/src/context/AuthContext.tsx) calls `getSession`, subscribes to `onAuthStateChange`, and fetches the matching `profiles` row. `signIn` uses `signInWithPassword`; the same email/password form handles admin, warden, and student accounts, and the database-loaded `profiles.role` drives portal routing. The owner verified admin sign-in and Admin Dashboard routing in browser. No separate warden login option is intended. `signOut` calls Supabase sign-out and clears local demo state.

When either variable is absent or contains `placeholder`, the app enters explicit offline demo mode. It loads a local-storage demo session and `signIn` infers a role from the email, with no password validation. Demo profiles are `student@hostelhub.com`, `warden@hostelhub.com`, and `admin@hostelhub.com`; unknown emails are also assigned a role by substring/default logic. This is useful for visual work but is not authentication and must not be presented as secure or persistent database behavior.

`ProtectedRoute` blocks missing users and redirects users with a known wrong role to their role home. The owner verified the admin route. Warden dashboard routing has not yet been tested in browser; do not treat the existing route guard as a substitute for RLS.

Expected permissions for the MVP are:

- **Admin:** manage hostels, rooms, students, allocations, complaints, leave, and notices; view operational statistics.
- **Warden:** operate within assigned hostel(s), review complaints and leave, manage relevant rooms/students/notices according to policy.
- **Student:** view their own profile/room/requests and submit their own complaints/leave; read applicable notices; never modify another student or elevate their role.

These expectations must be enforced by RLS and database constraints, not only by React routes or hidden buttons. Admin sign-in/routing, signup role hardening, and the specified student SELECT policy were verified by the owner. Warden sign-in/routing, student ownership tests, and the full unauthorized-access matrix remain **Not verified**.

## G. Service and Data-Flow Reference

Services generally return `{ data, error }`-style results. Several still use in-memory mock arrays when Supabase is unconfigured; those changes are not persistent. Hostel services now return a configuration error instead of mock hostels, and configured hostel/student pages use real service calls. Other audited modules/pages still require integration.

| Service | Functions | Tables | Intended callers | Current state |
|---|---|---|---|---|
| [`src/services/hostelsService.ts`](hostel-management/src/services/hostelsService.ts) | `getHostels`, `getHostelById`, `createHostel`, `getHostelWardens`, `getHostelDirectory` | `hostels`, `profiles`, `rooms`, `students` | Admin hostels, student forms, warden context | Admin directory/create wired; no static-hostel fallback; browser create + refresh confirmed by owner |
| [`src/services/roomsService.ts`](hostel-management/src/services/roomsService.ts) | `getRooms`, `getRoomById`, `createRoom`, `updateRoom` | `rooms`, joined `hostels` | Admin/warden rooms and allocation | Orphaned; local mocks otherwise |
| [`src/services/studentsService.ts`](hostel-management/src/services/studentsService.ts) | `getStudents`, `getStudentById`, `getStudentByUserId`, `createStudent`, `updateStudent`, `assignRoom` | `students`, joined `hostels`/`rooms` | Admin/warden/student profile and allocation | Admin/warden student directories and admin record form wired; real allocation UI remains unconnected; explicit actual/intended hostel FK aliases |
| [`src/services/complaintsService.ts`](hostel-management/src/services/complaintsService.ts) | `getComplaints`, `getComplaintById`, `createComplaint`, `updateComplaintStatus` | `complaints`, joined students/rooms | Student/warden/admin complaint pages | Orphaned; local mocks otherwise |
| [`src/services/leaveService.ts`](hostel-management/src/services/leaveService.ts) | `getLeaveRequests`, `getLeaveRequestById`, `createLeaveRequest`, `updateLeaveStatus` | `leave_requests`, joined students/rooms | Student/warden/admin leave pages | Orphaned; local mocks otherwise |
| [`src/services/noticesService.ts`](hostel-management/src/services/noticesService.ts) | `getNotices`, `createNotice`, `deleteNotice` | `notices`, joined profiles | All notice pages | Orphaned; local mocks otherwise |

There is no fee service, table, page, route or type: fee management is out of scope for this release (placeholder pages, routes and the unused `Fee` type were removed on 2026-10-21).

Specific service risks to address during implementation:

- `getStudentByUserId` returns `mockStudents[0]` when a requested demo user is absent, which can display the wrong student.
- `studentsService.getStudents` interpolates search text into a PostgREST `.or(...)` expression; validate/encode search input and test punctuation.
- `noticesService.getNotices` interpolates `hostelId` into a filter expression; validate UUID input.
- `assignRoom` accepts an optional `hostelId`, while the SQL trigger derives hostel from room; treat the database as authoritative and test mismatch behavior.
- Several service payload types allow fields that should be server-controlled, such as `posted_by`, status, occupancy, or role-related data. Keep privileged fields out of student/client forms.

## H. Bugs, Gaps, and Risks

### Confirmed from the audited code

| Severity | Evidence | Impact | Recommended next action |
|---|---|---|---|
| High | Several admin/warden/student pages still use local arrays or are not connected to services; hostel directory and admin/warden student directory are connected. | Remaining workflows may still show non-persistent data. | Continue one vertical slice at a time; verify student admission and pending allocation next. |
| High | Demo `signIn` in [`AuthContext.tsx`](hostel-management/src/context/AuthContext.tsx) infers role and ignores password when configuration is missing | Offline mode can accept arbitrary credentials and must never be treated as real auth. | Use only for explicitly labeled local UI demo; verify configured mode before MVP demonstration. |
| Resolved in code; live role test pending | `ProtectedRoute` now redirects an authenticated user with no validated role to login. | Prevents profile-less sessions from entering a role layout; live role matrix is not complete. | Keep this code behavior and verify with controlled accounts. |
| High | Local baseline SQL includes metadata-based profile role logic, while the owner reports deployed signup hardening forces `student`. | Local SQL and deployed security behavior differ; rerunning an old migration blindly could regress the deployed setup. | Do not rerun signup migration without checking current deployed functions/triggers; keep admin/warden promotion trusted and audited. |
| High | Notice insert policy does not require `posted_by = auth.uid()` | A permitted author can attribute notices to another profile. | Set author from authenticated identity or enforce it in policy/database. |
| High | Warden RLS policies broadly allow all wardens to select complaints, leave, and students | Cross-hostel privacy and operational isolation risk. | Scope policies and queries to assigned hostel, then test two-warden access. |
| Medium | `getStudentByUserId` mock fallback returns first student | Wrong private profile/room can display in demo mode. | Return null/not found when no matching user exists. |
| Medium | Search/filter values are interpolated into PostgREST filter strings | Malformed input or unintended filtering; robustness risk. | Validate IDs and safely encode search input. |
| Medium | Forms/buttons outside the connected hostel/student slices (including complaint and leave decisions) remain partly unhandled. | User may see actions that are not persistent. | Connect handlers with loading, errors, and refresh. |
| Medium | Dashboards show fixed counts and “live” activity text | Misleading operational metrics. | Compute from service results and label loading/empty/error states. |
| Low | No automated test setup or test script | Regressions in auth/RLS/workflows can go undetected. | Add focused tests only after the first real vertical slice is working. |
| Low | [`src/components/ui/Modal.tsx`](hostel-management/src/components/ui/Modal.tsx) has accessibility/backdrop concerns reported by inspection | Keyboard/backdrop interaction may be inconsistent. | Validate in browser and improve labels/focus behavior as part of form wiring. |
| Low | Build emits a chunk larger than 500 kB after minification | Performance warning, not an MVP blocker. | Consider route-level code splitting after core functionality. |

### Assumptions and untested areas

- The deployed schema differs from the original local SQL in reviewed security functions/policies and includes the applied intended-hostel migration; the full deployed schema was not independently exported here.
- `.env` is ignored and was not opened. No secret values were copied here.
- Warden dashboard login/routing, student workflow, and most RLS runtime behaviors remain unverified.
- The SQL script’s seed hostels are local definitions; they are not evidence of live rows.
- Build success proves compilation/bundling only. It proves neither database access nor workflow correctness.

## I. Prioritised Four-Day Roadmap

Do not restart the UI. Work in vertical slices and keep each checkbox unchecked until the acceptance criteria and verification method pass.

### Day 1: Foundation and database readiness

- [ ] **P0 | Status: Pending | Dependencies: project credentials and approval to inspect live state | Files:** [`src/lib/supabase.ts`](hostel-management/src/lib/supabase.ts), [`src/context/AuthContext.tsx`](hostel-management/src/context/AuthContext.tsx), [`supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql) | **Acceptance:** configured browser uses only the publishable/anon key; at least one admin, warden, and student test account has a matching profile; schema/policies/triggers are reconciled with the local SQL; missing profile/role fails closed. **Verification:** controlled login/session/RLS checks; record live result here without secrets.
- [ ] **P0 | Status: Partial | Dependencies: first task | Files:** [`src/services/`](hostel-management/src/services/), role pages | **Acceptance:** each MVP page loads through its existing service; errors and loading states are visible; no page relies on hardcoded operational records. **Verification:** inspect caller graph and reload with configured Supabase.
- [ ] **P1 | Status: Pending | Dependencies: environment setup | Files:** [`src/services/studentsService.ts`](hostel-management/src/services/studentsService.ts), [`src/services/noticesService.ts`](hostel-management/src/services/noticesService.ts) | **Acceptance:** IDs/search are validated and no incorrect mock student fallback remains. **Verification:** unit/manual edge cases with malformed search and unknown user.
- [ ] **P1 | Status: Pending | Dependencies: schema policy review | Files:** [`supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql) | **Acceptance:** role creation, notice authorship, and assigned-warden scope are explicitly secure and tested. **Verification:** unauthorized SQL/API attempts with separate accounts.

### Day 2: Administration

- [x] **P0 | Status: Verified by owner | Dependencies: Day 1 database readiness | Files:** [`src/pages/admin/Hostels.tsx`](hostel-management/src/pages/admin/Hostels.tsx), [`src/services/hostelsService.ts`](hostel-management/src/services/hostelsService.ts) | **Acceptance:** admin creates/list-refreshes a hostel with validation and errors. **Verification:** owner created `hostel A`, confirmed its row in Supabase, refreshed, and confirmed it appears.
- [ ] **P0 | Status: Partial | Dependencies: hostel CRUD | Files:** [`src/pages/admin/Rooms.tsx`](hostel-management/src/pages/admin/Rooms.tsx), [`src/services/roomsService.ts`](hostel-management/src/services/roomsService.ts) | **Acceptance:** admin creates and updates a room; duplicate room number per hostel and invalid capacity are rejected. **Verification:** UI/API operation and refresh.
- [ ] **P0 | Status: Partial | Dependencies: hostel/room data | Files:** [`src/pages/admin/Students.tsx`](hostel-management/src/pages/admin/Students.tsx), [`src/services/studentsService.ts`](hostel-management/src/services/studentsService.ts) | **Acceptance:** admin registers a student with valid identity fields and can reload the record. **Verification:** create, query, refresh.
- [ ] **P0 | Status: Partial | Dependencies: rooms and students | Files:** [`src/pages/admin/Allocations.tsx`](hostel-management/src/pages/admin/Allocations.tsx), [`src/services/studentsService.ts`](hostel-management/src/services/studentsService.ts), [`supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql) | **Acceptance:** allocation/transfer updates student and room occupancy; full room is rejected; hostel mismatch cannot be persisted. **Verification:** allocate to available room, fill room, attempt one extra, reload counts.

### Day 3: Workflows

- [ ] **P0 | Status: Partial | Dependencies: student records and auth | Files:** student/warden/admin complaint pages and [`complaintsService.ts`](hostel-management/src/services/complaintsService.ts) | **Acceptance:** student submits a complaint; student sees only own records; warden/admin changes status; status survives refresh. **Verification:** two-account ownership and status test.
- [ ] **P0 | Status: Partial | Dependencies: student records and auth | Files:** student/warden/admin leave pages and [`leaveService.ts`](hostel-management/src/services/leaveService.ts) | **Acceptance:** student submits valid date range; warden approves/rejects with optional remark; student sees result after relogin/refresh. **Verification:** invalid date, approval, rejection, ownership test.
- [ ] **P1 | Status: Partial | Dependencies: profile/hostel data and auth | Files:** notice pages and [`noticesService.ts`](hostel-management/src/services/noticesService.ts) | **Acceptance:** authorized admin/warden publishes; students see applicable notices; unauthorized author/delete attempts fail. **Verification:** publish, visibility, delete/RLS test.
- [x] **P1 | Status: Decided — out of scope for this release (2026-10-21)** | Fee management is excluded: no fee schema, service, routes or pages exist, and the placeholder `/admin/fees` and `/student/fees` routes, pages and unused `Fee`/`FeeStatus` types were removed. No payment integration.

### Day 4: Integration and demonstration

- [ ] **P0 | Status: Partial | Dependencies: Days 1-3 persisted records | Files:** all dashboard pages | **Acceptance:** admin/warden/student metrics are calculated from current database records, not constants. **Verification:** create/change records and confirm metric changes after refresh.
- [ ] **P0 | Status: Not verified | Dependencies: all workflows | Files:** route groups, schema, services | **Acceptance:** admin, warden, and student cannot access or mutate disallowed records; route and RLS decisions agree. **Verification:** role matrix with separate accounts and direct API attempts.
- [ ] **P0 | Status: Pending | Dependencies: all MVP slices | Files:** project handoff, test notes | **Acceptance:** fresh-load demo from login through status updates works without manual database edits during the presentation. **Verification:** timed clean-session rehearsal.
- [ ] **P1 | Status: Pending | Dependencies: demo rehearsal | Files:** [`package.json`](hostel-management/package.json), handoff | **Acceptance:** lint/build pass, blockers and known limitations are visible, and no secrets or local temp artifacts are committed. **Verification:** commands in Section K and `git status`.

## J. Persistent Task Checklist

### Completed and verified in this audit

- [x] Repository location, branch, HEAD, working-tree status, and recent commit inspected.
- [x] Public, student, warden, and admin route definitions inspected.
- [x] Shared layout/UI component inventory inspected.
- [x] Auth context, login, logout, Supabase client, and protected route behavior inspected.
- [x] Local schema tables, keys, constraints, triggers, helper functions, seed block, and RLS policies inspected.
- [x] All six service modules and their mock/Supabase branches inspected.
- [x] Page/service caller search completed; no role page service callers found.
- [x] `npm run lint` passed from `hostel-management/`.
- [x] `npm run build` passed from `hostel-management/`; Vite reported a chunk-size warning.
- [x] Root handoff document created at [`HOSTEL_PROJECT_HANDOFF.md`](HOSTEL_PROJECT_HANDOFF.md).
- [x] Local Supabase environment configured in ignored `hostel-management/.env.local` without recording values here.
- [x] Read-only connection attempt completed; project responded with `PGRST205` for missing `public.hostels` at that historical point. Later owner verification supersedes that state.

### Verified in follow-up sessions (owner-reported live checks)

- [x] Admin account promotion, sign-in, and Admin Dashboard routing.
- [x] Deployed signup profile role forced to `student`; deployed role-protection trigger/function and student SELECT policy inspected.
- [x] Intended-hostel migration applied; named FK and `students_select_scoped` policy verified; no existing records were backfilled.
- [x] Admin Students page loads after explicit actual/intended hostel FK embeds were added.
- [x] Hostel creation persisted; `hostel A` appeared after browser refresh and was assigned to an existing warden profile.
- [ ] Warden sign-in/Dashboard routing and student admission → pending-allocation queue are not yet browser-verified.

### In progress

- [ ] Connect remaining pages to the existing service layer.
- [ ] Continue reconciling the local baseline SQL with the deployed Supabase schema/policies; do not assume equivalence.
- [ ] Review and approve [`proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql) before any SQL Editor execution.
- [ ] Confirm `private` is not in the Supabase PostgREST exposed-schema list before applying the proposal.
- [ ] Verify only admins can manage hostel metadata and publish/manage global notices.
- [ ] Decide and secure the final demo authentication path.

### Pending implementation

- [x] Admin hostel create/list-refresh (owner verified); edit/delete not implemented and not in the current scope.
- [ ] Admin room CRUD and maintenance state.
- [ ] Verify admin student create/edit persistence and intended-hostel pending-queue workflow.
- [ ] Room allocation/transfer with capacity feedback.
- [ ] Student complaint submission and history.
- [ ] Warden/admin complaint status updates.
- [ ] Student leave submission and history.
- [ ] Warden/admin leave approval/rejection and remarks.
- [ ] Notice publishing, visibility, and deletion.
- [ ] Database-driven dashboards.
- [ ] Real persistence after refresh/relogin.
- [ ] Focused automated or repeatable workflow tests.

### Blockers

- [ ] Full deployed Supabase schema and RLS matrix are not independently verified; the owner has verified specific auth, student, and hostel objects/operations as listed above.
- [ ] Warden route and student test-account workflow remain to be verified in browser.
- [ ] RLS role escalation, notice authorship, and warden scope need explicit security verification.
- [ ] Existing role assignments and room occupancy need preflight review before applying hardening.

### Known bugs/risks to track

- [ ] Demo mode accepts arbitrary password values and infers roles from email.
- [ ] Missing profile role may pass `ProtectedRoute`.
- [ ] Mock student lookup can return the first student for an unknown user.
- [ ] PostgREST filter inputs are interpolated without validation.
- [ ] Local RLS policy design may expose cross-hostel/private records or permit unsafe role/profile creation.
- [ ] Many unrelated UI action buttons still do not perform persistence operations; hostel create/list and student directory/form are connected.

### Testing checklist

- [x] Static TypeScript/Vite production build.
- [x] Oxlint.
- [x] Admin login and Admin Dashboard routing (owner-verified).
- [ ] Warden login/Dashboard routing and student login/session persistence.
- [ ] Full admin/warden/student route matrix.
- [x] Hostel create and persistence after browser refresh (owner-verified).
- [ ] Student admission persistence and intended-hostel pending queue.
- [ ] Remaining CRUD and validation.
- [ ] Full-room allocation rejection and occupancy synchronization.
- [ ] Complaint and leave cross-account workflows.
- [ ] Notice visibility and authorisation.
- [ ] Direct unauthorized access/RLS attempts.

### Demo readiness

- [ ] Three real test accounts and matching profiles are prepared.
- [ ] Schema and RLS are applied and verified in the intended Supabase project.
- [ ] Admin-to-student-to-warden end-to-end workflow passes after a clean reload.
- [ ] Dashboard metrics change from database records.
- [ ] Known limitations are stated without presenting mock data as live data.

## K. Verification Commands and Test Matrix

Run commands from `hostel-management/`:

```powershell
Push-Location hostel-management
npm install                 # only when dependencies are intentionally installed; not run by this audit
npm test                    # added 2026-10-21: offline DB (PGlite) + UI checks
npm run lint
npm run build
npm run dev
npm run preview
Pop-Location
```

Original audit results (historical; later owner verification is summarized below):

| Check | Result | Evidence/next step |
|---|---|---|
| `npm run lint` | Passed | Oxlint exited successfully on 2026-10-18 after environment configuration. |
| `npm run build` | Passed with warning | TypeScript/Vite build succeeded after environment configuration; Vite warned about a minified chunk over 500 kB. |
| Supabase client/configuration | Configured | `.env.local` contains the expected variable names and project URL; `.env.local` is ignored by `hostel-management/.gitignore`; key value is intentionally not recorded. |
| Read-only `public.hostels` query | Failed: `PGRST205` | Request reached the supplied Supabase project, but the table was absent from the schema cache. Likely cause: local schema has not been applied to this project, or the project schema is different. Do not bypass RLS or apply SQL automatically. |
| Login/logout | Not run | Needs configured Supabase URL/key and test users; test both configured and demo mode separately. |
| Student/warden/admin access | Not run | Needs browser route matrix and profiles with each role. |
| Hostel/room/student CRUD | Not run | No page is connected to the service layer yet. |
| Allocation/capacity | Not run | Local trigger exists; needs live schema and full-room test. |
| Complaint submission/resolution | Not run | UI/service caller missing; implement then test two roles. |
| Leave approval/rejection | Not run | UI/service caller missing; implement then test two roles. |
| Notice visibility | Not run | UI/service caller missing; verify global/hostel filtering and author policy. |
| Persistence after refresh | Not run | Current pages use local constants; run only after wiring services. |
| RLS/unauthorized access | Not run | Requires controlled accounts and direct API attempts; never disable RLS to make a test pass. |
| Proposed SQL syntax/application | Not run | [`proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql) is review-only and was not sent to Supabase; validate in a disposable/staging database or approved SQL Editor session. |
| Function privileges/RPC exposure | Not run | Review `private` schema exposure and verify authenticated RLS evaluation works while anon/direct RPC execution is denied. |
| Concurrent allocation/unallocation | Not run | Requires two concurrent authenticated transactions plus room transfer-to-NULL tests; no live writes were attempted. |

Latest verification status (2026-10-18; live results reported by the project owner unless marked code check):

| Check | Result | Evidence/remaining work |
|---|---|---|
| Admin Supabase login and route | Verified by owner | Sign-in opened Admin Dashboard. |
| Deployed signup role and role protection | Verified by owner | New profiles are assigned `student`; named role-protection trigger/function inspected. Do not rerun a hardening migration without checking deployed definitions. |
| Intended-hostel migration | Verified by owner | Applied; named FK and `students_select_scoped` policy checked; no student backfill occurred. |
| Student relationship fix | Verified by owner | Admin → Students opened after the explicit FK-hint/alias fix. Student admission and warden queue remain untested. |
| Hostel creation/persistence/listing | Verified by owner | `hostel A` exists in Supabase and appeared after app refresh; assigned to an existing warden profile. |
| Warden sign-in/routing | Not tested | Next browser check. Do not repeat account email or UUID here. |
| Student pending-allocation workflow | Not tested | Create an unallocated student with intended hostel `hostel A`, refresh, then verify the assigned warden queue. |
| Room allocation/capacity | Not implemented/verified | Separate future task; do not imply allocation from intended-hostel selection. |
| `npm run lint` | Passed with warnings | Existing Oxlint hook warnings remain in Student Complaints, Student Leave, and Warden Dashboard. |
| `npm run build` | Passed with warning | Vite reported a minified bundle chunk larger than 500 kB. |
| `git diff --check` | Passed | Latest reported check passed; line-ending notices are not whitespace errors. |

*(2026-10-18 statement:)* No test runner is configured. **Corrected 2026-10-21:** `npm test` (= `test:db` + `test:ui`) runs 166 offline checks (rls 59, seed 56, ui 51 at the last run); `npm run test:live-dev` is a guarded dev-only live probe. Browser workflows still need manual testing: maintain a repeatable manual matrix with test account, route, operation, expected result, actual result, and timestamp. Do not mark a row passed from compilation alone.

## L. Security and Operational Rules

These rules are non-negotiable for all future sessions:

- Never expose a Supabase service-role or secret key in frontend code or any `VITE_` variable.
- Never commit `.env` or `.env.local`; keep only placeholders in `.env.example`.
- Use only the appropriate publishable/anon key in browser code.
- Preserve and verify RLS; never disable it to bypass permission problems.
- Students must not access or modify other students’ private records.
- Users must not elevate their own role.
- Enforce permissions in the database, not only in React route guards or navigation.
- Do not perform destructive SQL operations or delete data without explicit approval.
- Do not silently remove existing functionality or redesign the interface.
- Do not claim live database integration is working unless it has been tested against the intended Supabase project.
- Treat all local mock arrays and seed SQL as non-live until verified.
- Do not commit or push unless the project owner explicitly requests it.
- Ask before destructive operations, dependency changes, significant architecture changes, or live database changes.

## M. Session Log

> **Path note (2026-10-21):** links to `supabase/schema.sql` and `supabase/proposed_2026-10-18_security_hardening.sql` in this log now point to their archived copies under `supabase/archive/` (byte-identical to the originals). Entry text and dates are unchanged.

### 2026-10-18: Full repository audit and handoff creation

**Inspected:**

- Root/application directory structure and ignored files.
- Git branch, HEAD, recent history, tracked files, and working-tree changes.
- Package scripts/dependencies, TypeScript/Vite/Tailwind/Oxlint configuration, README, and environment example.
- All routes, page directories, shared UI/layout components, auth context, login/logout, protected routes, Supabase client, types, six service modules, and local SQL schema.
- Service caller search, hardcoded/mock data usage, and available test configuration.

**Files created:**

- [`HOSTEL_PROJECT_HANDOFF.md`](HOSTEL_PROJECT_HANDOFF.md), the only file intentionally created by this audit.

**Files not modified:**

- No application source, SQL, environment, package, Git, or existing documentation files were changed.

**Commands run and actual results:**

- `git status --short --branch`: `main` tracking `origin/main`; modified auth/app/schema files and untracked auth/service files plus `hostel-management/supabase/.temp/` were already present.
- `git log -5 --oneline --decorate`: HEAD and origin point to `b4b15f6 Initial commit: Hostel Management System`; no later commit was present.
- `npm run lint` from `hostel-management/`: passed.
- `npm run build` from `hostel-management/`: passed; Vite emitted a chunk-size warning for the approximately 583 kB JavaScript bundle.
- Initial root-level `npm run lint` and `npm run build`: failed with “Missing script” because scripts are application-level; no repository change resulted.

**Findings/decisions:**

- All historical route groups are present.
- The local schema is materially expanded and includes seven application tables, triggers, helper functions, RLS, and hostel seed statements.
- Services exist but are not used by audited pages.
- Pages use hardcoded data and inert workflow controls, so the MVP workflow is not complete.
- Fees remain secondary and have no database/service implementation.
- The roadmap starts with database/auth verification and a narrow vertical slice rather than a UI rewrite.

**Could not verify:**

- Live Supabase schema, rows, auth users, environment configuration, trigger installation, RLS runtime behavior, and end-to-end persistence.
- Browser interaction/accessibility and direct unauthorized API attempts.

**Remaining blockers:**

- Need approved configured Supabase environment and controlled admin/warden/student test accounts.
- Need a decision on whether local demo mode remains available for presentation.
- Need security review of role creation, notice authorship, and warden data scope.

**Next exact development task:**

> In the existing UI, implement and verify the first vertical slice: connect admin hostel/room/student allocation to `hostelsService`, `roomsService`, and `studentsService`, then test the database capacity trigger with a full-room rejection. Before coding, reconcile the live schema/RLS with the local SQL using approved credentials; update this handoff only with observed results.

### 2026-10-18: Supabase environment connection attempt

**Inspected:**

- Read this handoff completely before acting.
- Rechecked [`src/lib/supabase.ts`](hostel-management/src/lib/supabase.ts), [`hostel-management/.env.example`](hostel-management/.env.example), root/application ignore rules, and the complete local [`schema.sql`](hostel-management/supabase/archive/schema.sql).

**Files changed:**

- Created ignored [`hostel-management/.env.local`](hostel-management/.env.local) with the requested Supabase URL and publishable key. The key value is not reproduced in this document or output.
- Updated [`HOSTEL_PROJECT_HANDOFF.md`](HOSTEL_PROJECT_HANDOFF.md) only. No source, SQL, dependency, or Git history changes were made.

**Commands and actual results:**

- Checked variable names and URL without printing the key: expected names present; key present; key length reported only as `46`.
- `git check-ignore -v --no-index hostel-management/.env.local`: ignored by `hostel-management/.gitignore` rule `*.local`.
- `npm run lint` from `hostel-management/`: passed.
- `npm run build` from `hostel-management/`: passed; Vite again reported the existing over-500 kB chunk warning.
- Safe read-only Supabase client query: `from('hostels').select('id').limit(1)`. Result: failed with `PGRST205`, `Could not find the table 'public.hostels' in the schema cache`.

**Findings and decisions:**

- Environment configured: **Yes**.
- Supabase client initialized by the app build: **Yes**; valid variables prevent the local demo fallback according to the existing detection logic.
- Live Supabase endpoint/key connectivity: **Yes, minimally verified** because the request reached PostgREST and returned a structured database error.
- Live database schema: **Not verified / currently blocked** because `public.hostels` is not available in the schema cache.
- Authentication: **Not verified**.
- CRUD workflows: **Not verified**; pages remain disconnected from services.
- No SQL was run against the live project, and no tables, policies, data, or auth settings were changed.

**Manual action required:**

1. In the Supabase dashboard for the supplied project, open SQL Editor and review the local schema with the project owner/security requirements.
2. Before execution, resolve the documented role-escalation, warden-scope, student-privacy, and notice-authorship issues. Do not blindly run the current SQL as production policy.
3. With explicit approval, apply an approved schema/migration, then rerun the read-only table query and controlled RLS tests. Do not paste secrets into the SQL editor or handoff.

**Next exact development task:**

> Manually reconcile and approve the live Supabase schema/RLS in the dashboard. Once `public.hostels` and the other required tables exist, rerun the safe read-only query and create controlled admin/warden/student test accounts before wiring the first admin hostel/room/student allocation slice.

### 2026-10-18: Proposed database security hardening

**Inspected:**

- Re-read this handoff and the complete [`hostel-management/supabase/archive/schema.sql`](hostel-management/supabase/archive/schema.sql).
- Rechecked service callers and the current application implementation. Pages remain disconnected from the service layer; no CRUD workflow implementation was started.
- Reviewed every base table, relationship, constraint, trigger, helper function, RLS policy, and seed statement in the local SQL.

**File created:**

- [`hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql), a separate review-only migration proposal.

**What the proposal changes:**

- Forces new auth-trigger-created profiles to `student` and removes self-service profile insertion.
- Scopes wardens to assigned hostels and students to their own private records, while retaining admin access.
- Enforces notice authorship from `auth.uid()` and restricts warden notice operations by hostel.
- Adds helper functions for non-recursive relationship checks.
- Prevents non-admin identity and complaint/leave ownership reassignment.
- Reasserts room capacity validation and adds derived occupancy/status normalization without automatically repairing existing rows.

**Safety boundary:**

- No SQL was executed. No live connection was made with write capability. No tables, rows, auth users, policies, or live data were changed.
- The proposal contains no seed statements or destructive data operations. It does contain policy/trigger replacement DDL and a transaction because those are the intended reviewed changes if approved.
- The proposal assumes the base schema exists and fails closed otherwise. The live project currently reports missing `public.hostels`, so the owner must first decide how to apply/reconcile the base schema.

**Remaining blockers:**

- Migration has not been PostgreSQL-validated or applied.
- Existing role assignments and occupancy consistency are unknown.
- An approved trusted admin/warden bootstrap procedure and controlled RLS test accounts are still required.

**Next exact task:**

> Review the proposed migration with the project owner/database administrator, run its commented preflight queries manually in the Supabase SQL Editor if approved, resolve any existing data/policy conflicts, and only then apply the approved base-schema-plus-hardening plan. Keep the application CRUD workflow work paused until the schema and RLS test matrix pass.

### 2026-10-18: Security hardening proposal revision

**Inspected:**

- Re-read the proposed migration and the complete local schema.
- Audited all `SECURITY DEFINER` functions, existing policy names on all seven tables, trigger event definitions, room allocation behavior, notice visibility, ownership fields, and leave approval fields.

**Updated file:**

- Revised [`proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql). `schema.sql` and application code were not changed.

**Revision results:**

- Added private-schema policy helpers with explicit grants for authenticated RLS evaluation and revoked direct execution from old public helpers.
- Added complete policy inventory and fail-closed unexpected-policy detection; all 27 known policies are recreated with scoped predicates.
- Replaced permissive notice visibility with global-versus-hostel-specific access rules.
- Added deterministic room row locking for concurrent allocation/transfer checks and explicit NULL-room unallocation behavior.
- Added leave approval/remark/approver integrity enforcement and retained ownership immutability triggers.
- Added schema function-signature checks, explicit RLS enablement, and a role-based test matrix for admin, two wardens, and two students.

**Validation:**

- Static safety checks passed: no executable table/data-destructive statements, one `BEGIN`/`COMMIT` pair, 27 unique created policies, all seven tables referenced, required controls present, and no trailing whitespace.
- No SQL was executed, no live database connection was made, and no live object/data was changed.

**Remaining risks:**

- The proposal has not been parsed or executed by PostgreSQL; syntax, function ownership, trigger ordering, and RLS behavior remain unverified.
- Supabase PostgREST exposure of `private` must be checked manually; authenticated EXECUTE is intentionally granted for policy evaluation.
- Existing live policy names outside the documented set cause an abort and require manual reconciliation.
- Existing roles, `warden_id` assignments, and room occupancy inconsistencies remain unknown.

**Next exact task:**

> Review the revised migration and preflight inventory, confirm the private schema is not exposed through PostgREST, and validate it in a disposable/staging database or approved SQL Editor session before any production application.

### 2026-10-18: Final security and correctness review

**Updated:** [`proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql) remains separate from [`schema.sql`](hostel-management/supabase/archive/schema.sql) and unapplied.

**Resolutions:**

- `private.enforce_leave_workflow()` now handles `INSERT` and `UPDATE`: authenticated inserts are forced to `pending` with NULL `approved_by` and `remark`; students cannot approve/reject or alter approval metadata; only admins/assigned wardens may transition pending requests; wardens cannot re-decide finalized requests.
- Added `private.enforce_complaint_integrity()` for INSERT/room-or-owner UPDATE. Complaint `room_id` must match the student’s current room; non-admin room and ownership reassignment is rejected; wardens must remain within the student hostel scope.
- Added an executable `pgrst.db_schemas` gate that aborts if the private schema is exposed or if the setting is unavailable. The mandatory manual fallback is Supabase Dashboard > Settings > API > Exposed schemas: confirm `private` is absent before application.
- `private.can_view_profile()` now requires both hostel assignment and `private.is_warden()` for warden visibility.
- Wardens can no longer update hostel metadata or publish/update/delete global notices. Only admins manage hostel metadata and global notices; wardens manage notices for their assigned hostel.
- Trigger declarations were reviewed for supported PostgreSQL event forms; required EXECUTE grants are explicit for RLS helpers and revoked for trigger-only functions.

**Validation and remaining risks:**

- Static checks passed for required controls, policy uniqueness, non-destructive scope, transaction structure, formatting, and all seven table references.
- SQL was not executed or connected to Supabase. PostgreSQL parsing, trigger ordering, lock behavior, function ownership, PostgREST configuration, and RLS behavior remain **Not verified**.
- Existing live policy names, role assignments, warden assignments, and occupancy inconsistencies remain unknown.

**Next exact task:**

> Review the complete migration, confirm the private schema is absent from PostgREST exposed schemas, validate the SQL in disposable/staging PostgreSQL, then run the five-account RLS/concurrency test matrix before any live application.

### 2026-10-18: Focused migration correction

**Updated:** [`proposed_2026-10-18_security_hardening.sql`](hostel-management/supabase/archive/proposed_2026-10-18_security_hardening.sql). The migration remains unapplied; no application code, base schema, live database, or Git history was changed.

**Exact corrections:**

- Leave INSERT normalization now runs before the authentication branch, forcing every inserted request to `pending` with NULL `approved_by` and `remark`; authenticated non-admin inserts must belong to the current student.
- Leave UPDATE rules retain only pending-to-approved/rejected transitions for assigned wardens/admins, prevent students from changing approval metadata, and reject warden edits to finalized requests.
- Added a complaint INSERT/UPDATE trigger that requires `room_id` to equal the referenced student’s current room and rejects non-admin ownership/room reassignment outside the student or assigned-warden scope.
- The PostgREST gate now fails closed for null, empty, or `private`-containing `pgrst.db_schemas`; the mandatory manual check remains Dashboard > Settings > API > Exposed schemas, with `private` absent.
- Confirmed `private.can_view_profile()` checks both warden role and assigned hostel.
- Hostel UPDATE policy is admin-only; global notices (`hostel_id IS NULL`) are admin-only for create/update/delete, while wardens are limited to their assigned hostel.
- Split every mixed-event trigger into separate PostgreSQL declarations: complaint insert/update, leave insert/update, room insert/update, student allocation insert/update, and occupancy insert/update/delete.
- Repaired an accidental comment insertion that had corrupted the notices SELECT policy; it now has a complete executable `USING` clause.

**Validation:**

- Static checks confirmed no mixed-event trigger declarations remain, required controls are present, policies remain unique, transaction markers are balanced, and no executable data-destructive statements were added.
- No local PostgreSQL parser, `psql`, or isolated PostgreSQL database was available. PostgreSQL syntax, trigger ordering, function ownership, concurrency, and RLS behavior remain **Not verified**.

**Next exact task:**

> Validate the complete unapplied migration with PostgreSQL in an isolated/staging database, then execute the five-account RLS and concurrent allocation test matrix only after review approval.

### 2026-10-18: Supabase authentication integration

> This entry records the state at that point in the session; the latest live account/migration/workflow status is in the current-session entry below.

**Files changed:**

- [`hostel-management/src/context/authContextDef.ts`](hostel-management/src/context/authContextDef.ts): added the typed `signUp` contract.
- [`hostel-management/src/context/AuthContext.tsx`](hostel-management/src/context/AuthContext.tsx): added Supabase signup with full-name metadata only, runtime profile/role validation, fail-closed missing-profile handling, and safer auth-state cleanup.
- [`hostel-management/src/components/auth/ProtectedRoute.tsx`](hostel-management/src/components/auth/ProtectedRoute.tsx): rejects authenticated sessions without a validated role.
- [`hostel-management/src/pages/Register.tsx`](hostel-management/src/pages/Register.tsx): added registration form, validation, confirmation messaging, and live-configuration guard.
- [`hostel-management/src/pages/Login.tsx`](hostel-management/src/pages/Login.tsx): added registration link and hides misleading demo sign-in cards in live mode.
- [`hostel-management/src/App.tsx`](hostel-management/src/App.tsx): added `/register` while preserving existing routes.
- [`HOSTEL_PROJECT_HANDOFF.md`](HOSTEL_PROJECT_HANDOFF.md): recorded this session.

**Verification:**

- Type diagnostics: no errors in changed auth, route, login, registration, or app files.
- `npm run lint`: passed.
- `npm run build`: passed; Vite retained the existing large-chunk warning.
- Safe unauthenticated read of `public.profiles` using the configured client reached Supabase and returned `42501 permission denied for table profiles`. This is consistent with the reviewed RLS policy requiring `authenticated`; authenticated access, signup, confirmation, and CRUD remain unverified.

> The following integration boundary is a historical snapshot from the authentication-integration session; its account and service status is superseded by the latest session entry above.

**Current integration boundary at that time:**

- Registration and real login paths are implemented, but there are no confirmed application users yet.
- All role pages still use hardcoded/mock arrays; no page currently imports a service module.
- The next application task is to create the first confirmed user, promote the verified account through the trusted SQL Editor bootstrap procedure, then connect one narrow admin/student/warden workflow to the existing services.

### 2026-10-18: Live admin, student relationship, and hostel workflow progress

**Verified live progress (reported by the project owner):**

- The admin account was promoted successfully. The shared Supabase email/password form signs it in and routes to the Admin Dashboard. No separate role login or public role selector is used.
- Deployed `private.handle_new_user()` assigns new profiles the `student` role. `trg_prevent_role_escalation` calls `private.prevent_profile_role_escalation()`. The deployed `students_select_scoped` policy uses private helper functions. These are deployed-state facts reported from the owner's manual verification, not independently queried during this handoff update.
- `20261018130000_pending_allocation_intended_hostel.sql` was applied successfully. The owner verified `students_intended_hostel_id_fkey` references `hostels` and rechecked `students_select_scoped`. Existing student rows were not backfilled by the migration.
- Student list embeds were corrected to specify the actual and intended hostel foreign keys using distinct aliases `actual_hostel` and `intended_hostel`. The owner confirmed Admin → Students loaded without the ambiguity error.
- The Admin Hostel Buildings page now uses real Supabase hostel, room, and allocation data. Add Hostel persists to `public.hostels`. The owner created `hostel A`, verified its database row, refreshed the app, and confirmed it appears in the directory. Its warden assignment was also confirmed against an existing warden profile; no account email or UUID is repeated here.
- A warden account was created through signup/email confirmation and its existing profile was promoted to `warden` in a targeted SQL transaction. The owner confirmed the profile name `warden 1` and its assignment to `hostel A`. Warden login/dashboard routing has not yet been checked in browser.

**Code and checks:**

- Student admission remains a student-record operation and does not create Auth accounts. Intended-hostel selection is separate from actual room allocation.
- The directory loading follow-up preserves hostel rows when room/student statistics fail and displays those errors separately. No schema, migration, RLS, or auth changes were made during that code correction.
- The most recent implementation checks reported: `npm run lint` passed with existing hook warnings in Student Complaints, Student Leave, and Warden Dashboard; `npm run build` passed with Vite's large-chunk warning; `git diff --check` passed. These checks were run before the handoff-only update.
- Existing modified and untracked project work was preserved. No credentials or `.env.local` values are included in this document.

**Exact stopping point / next action:**

> Sign in as admin; create an identifiable student under intended hostel `hostel A` without a room; refresh Admin → Students and verify it persists; sign in as `warden 1`, verify Warden Dashboard routing, then check Warden → Students → Pending Allocation. Fix only observed errors. Room allocation, capacity enforcement through the UI, complaints, leave, notices, fees, and complete RLS/role testing remain subsequent work.

No live operation or SQL was performed by the assistant while updating this handoff.

### 2026-10-20: Audit, linking security fix, workflow completion

- Audited repo against handoff; found 2026-10-19 work committed in `0d274b2` but undocumented.
- Added `npm run test:db` (PGlite devDependency `@electric-sql/pglite@0.3.15`, [supabase/tests/](hostel-management/supabase/tests/)): first real-Postgres execution of the baseline and migrations.
- Proved 20261019140000 cannot apply on the deployed baseline; proved the profile-email hijack precondition on the current schema.
- Wrote/tested migration 20261020120000 + rollback; removed client-side linking; added recovery/resend; wired Profile, Room, Leave, Notices, Allocations, room edit; Fees out of scope.
- No live SQL was run and no live data was touched. Details and pending owner actions: "Latest status — 2026-10-20" at the top.
- Later 2026-10-20: migration link triggers made fail-safe (never block sign-up); production build guard against demo mode; deployment paused by owner.
- Dev-data phase: owner chose a separate dev project. Added seed tooling + 43 seed tests; admin hostel edit/delete, admin complaint actions, student leave silent-failure fix, dev project-ref indicator on Login. Checks: test:db 51+43 passed, tsc pass, lint 5 pre-existing warnings, build pass, all 9 client routes serve from the production build. No browser automation available in this environment; browser E2E pending owner's dev project.

## N. Instructions for the Next AI Assistant

Use the following prompt at the start of every session:

```text
Read HOSTEL_PROJECT_HANDOFF.md completely before changing anything. Then inspect the current repository, application directory, Git status, and the specific files relevant to the highest-priority unfinished task. Reconcile the handoff tracker with the actual implementation; do not trust a checkbox or historical statement without evidence.

Resume from the highest-priority unfinished task, beginning with the smallest vertical slice that advances the four-day MVP. Reuse the existing React pages, layouts, UI components, Supabase client, service modules, types, schema, and routing. Preserve the current UI and architecture unless a significant change is necessary and approved. Work incrementally; do not rewrite the application or introduce another backend.

Use only safe, approved Supabase configuration. Never expose secrets, service-role keys, or .env values. Preserve RLS and database-side authorization. Never bypass a permission problem by disabling RLS. Ask before destructive SQL, deleting data, changing dependencies, committing/pushing, or making a significant architectural or visual change.

After each focused change, run the most relevant validation, then run npm run lint and npm run build from hostel-management when practical. For database workflows, verify real persistence, refresh/relogin behavior, room capacity, ownership, role access, and unauthorized access with controlled accounts. Do not call mock data or hardcoded UI evidence a passing database test.

Before ending the session, update HOSTEL_PROJECT_HANDOFF.md: adjust statuses and checkboxes only for work genuinely verified, append a dated session-log entry preserving prior entries, record exact commands/results, list blockers and known bugs, and state the next exact action. Report files changed, test results, unverified areas, blockers, and the next task. Never commit or push unless explicitly requested.
```
