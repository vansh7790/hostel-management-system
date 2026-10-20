import { PageHeader } from '../../components/layout';
import LeaveReview from '../../components/leave/LeaveReview';

export default function WardenLeave() {
  return (
    <div>
      <PageHeader title="Leave Requests" description="Review and decide leave requests from students in your assigned hostel." />
      <LeaveReview scopeLabel="for your assigned hostel" />
    </div>
  );
}
