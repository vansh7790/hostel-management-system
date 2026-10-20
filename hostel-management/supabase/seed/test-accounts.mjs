// Fictional DEV-ONLY test logins. Every address uses the reserved
// hostel-test.example domain (RFC 2606: can never receive real email), which is
// also how seed cleanup identifies test accounts. No passwords live here; the
// account script reads SEED_TEST_PASSWORD from a git-ignored env file.
//
// Students with an account here have a matching record (same email + studentId)
// in dev_seed.sql, so the database links them automatically. Seeded students
// without an account here stay unlinked on purpose (edge case).

export const TEST_EMAIL_DOMAIN = 'hostel-test.example';

export const TEST_ACCOUNTS = [
  { email: 'admin.test@hostel-test.example', fullName: 'Neha Kapoor', role: 'admin' },
  { email: 'warden.aravali@hostel-test.example', fullName: 'Vikram Rathore', role: 'warden' },
  { email: 'warden.nilgiri@hostel-test.example', fullName: 'Meenakshi Iyer', role: 'warden' },
  { email: 'warden.shivalik@hostel-test.example', fullName: 'Suresh Deshpande', role: 'warden' },
  { email: 'aarav.mehta@hostel-test.example', fullName: 'Aarav Mehta', role: 'student', studentId: 'TST26-001' },
  { email: 'rohan.iyer@hostel-test.example', fullName: 'Rohan Iyer', role: 'student', studentId: 'TST26-003' },
  { email: 'arjun.nair@hostel-test.example', fullName: 'Arjun Nair', role: 'student', studentId: 'TST26-004' },
  { email: 'ananya.sharma@hostel-test.example', fullName: 'Ananya Sharma', role: 'student', studentId: 'TST26-009' },
  { email: 'priya.menon@hostel-test.example', fullName: 'Priya Menon', role: 'student', studentId: 'TST26-011' },
  { email: 'sneha.pillai@hostel-test.example', fullName: 'Sneha Pillai', role: 'student', studentId: 'TST26-013' },
  { email: 'aditya.kulkarni@hostel-test.example', fullName: 'Aditya Kulkarni', role: 'student', studentId: 'TST26-015' },
  { email: 'meera.joshi@hostel-test.example', fullName: 'Meera Joshi', role: 'student', studentId: 'TST26-017' },
];
