# Archived SQL — DO NOT RUN

These files are kept for history only. None of them may be applied to any
Supabase project (development or production).

| File | Why it is archived |
|---|---|
| `migrations/20261018120000_harden_signup_role.sql` | Targets `public.handle_new_user()`, which does not exist in the deployed baseline (`private.handle_new_user()` already forces new profiles to `student`). |
| `migrations/20261019140000_link_verified_student_accounts.sql` | Aborts on the deployed baseline (`function "public.handle_new_user()" does not exist`). Superseded by `migrations/20261020120000_secure_student_account_linking.sql`. |
| `rollback/20261019140000_link_verified_student_accounts.sql` | Rollback for the superseded file above. |
| `schema.sql` | Outdated baseline with broad warden policies and metadata-based roles. The deployed baseline is `supabase/initial_setup_review3.sql`. |
| `proposed_2026-10-18_security_hardening.sql` | Review-only proposal, superseded by `initial_setup_review3.sql` and the migrations folder. |

Apply order for a database (see `HOSTEL_PROJECT_HANDOFF.md`):
`initial_setup_review3.sql` → `migrations/` in filename order.
