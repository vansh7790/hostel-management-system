import { Card } from '../ui';

// Shown when a signed-in student account has no linked student record yet.
export default function UnlinkedStudentNotice() {
  return (
    <Card>
      <h2 className="font-semibold text-gray-900">Student registration is pending</h2>
      <p className="mt-2 text-sm text-gray-600">
        Your sign-in is not linked to a student record yet. The hostel administrator must create your record with the
        same email and student ID you registered with. Once your email is confirmed and the details match exactly, the
        account links automatically. Contact the administrator if this message persists.
      </p>
    </Card>
  );
}
