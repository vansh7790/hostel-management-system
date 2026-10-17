import { PageHeader } from '../../components/layout';
import { Card, Badge, Input } from '../../components/ui';
import { Search } from 'lucide-react';

export default function AdminLeave() {
  const requests = [
    { id: '1', student: 'John Doe', hostel: 'Hostel A', reason: 'Family function', dates: 'Oct 5-8', status: 'pending' as const },
    { id: '2', student: 'Sarah M.', hostel: 'Hostel C', reason: 'Medical visit', dates: 'Oct 3-4', status: 'approved' as const },
    { id: '3', student: 'Vikram P.', hostel: 'Hostel B', reason: 'Personal', dates: 'Sep 20-22', status: 'rejected' as const },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="warning" dot>Pending</Badge>;
      case 'approved': return <Badge variant="success" dot>Approved</Badge>;
      case 'rejected': return <Badge variant="danger" dot>Rejected</Badge>;
      default: return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div>
      <PageHeader title="All Leave Requests" description="View leave requests across all hostels." />
      <div className="mb-6"><Input placeholder="Search requests..." leftIcon={<Search className="h-4 w-4" />} /></div>
      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{r.student}</p>
                <p className="text-sm text-gray-500">{r.hostel} · {r.reason} · {r.dates}</p>
              </div>
              {getStatusBadge(r.status)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
