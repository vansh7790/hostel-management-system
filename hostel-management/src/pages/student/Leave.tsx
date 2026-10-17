import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Card, Button } from '../../components/ui';

export default function StudentLeave() {
  const requests = [
    { id: '1', reason: 'Family function', destination: 'Mumbai', dates: 'Oct 5 - Oct 8', status: 'pending' as const },
    { id: '2', reason: 'Medical appointment', destination: 'Delhi', dates: 'Sep 20 - Sep 21', status: 'approved' as const },
    { id: '3', reason: 'Personal work', destination: 'Pune', dates: 'Sep 10 - Sep 12', status: 'rejected' as const },
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
      <PageHeader
        title="Leave Requests"
        description="Apply for leave and track your request status."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>Apply Leave</Button>}
      />
      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{r.reason}</p>
                <p className="text-sm text-gray-500">{r.destination} · {r.dates}</p>
              </div>
              {getStatusBadge(r.status)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
