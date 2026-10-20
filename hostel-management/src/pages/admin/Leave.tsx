import { PageHeader } from '../../components/layout';
import LeaveReview from '../../components/leave/LeaveReview';

export default function AdminLeave() {
  return (
    <div>
      <PageHeader title="All Leave Requests" description="Review leave requests across all hostels." />
      <LeaveReview scopeLabel="across hostels" />
    </div>
  );
}
