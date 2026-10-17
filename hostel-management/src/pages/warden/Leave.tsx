import { PageHeader } from '../../components/layout';
import { Card, Badge, Button } from '../../components/ui';
import { Check, X } from 'lucide-react';

export default function WardenLeave() {
  const requests = [
    { id: '1', student: 'John Doe', reason: 'Family function', destination: 'Mumbai', dates: 'Oct 5-8', status: 'pending' as const },
    { id: '2', student: 'Sarah M.', reason: 'Medical visit', destination: 'Delhi', dates: 'Oct 3-4', status: 'pending' as const },
    { id: '3', student: 'Rahul K.', reason: 'Personal', destination: 'Pune', dates: 'Sep 20-22', status: 'approved' as const },
  ];

  return (
    <div>
      <PageHeader title="Leave Requests" description="Review and manage student leave requests." />
      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id} padding="sm" hover>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-medium text-gray-900">{r.student}</p>
                <p className="text-sm text-gray-500">{r.reason} · {r.destination} · {r.dates}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.status === 'pending' ? (
                  <>
                    <Button size="sm" variant="outline" leftIcon={<X className="h-4 w-4" />}>Reject</Button>
                    <Button size="sm" leftIcon={<Check className="h-4 w-4" />}>Approve</Button>
                  </>
                ) : (
                  <Badge variant={r.status === 'approved' ? 'success' : 'danger'} dot>
                    {r.status === 'approved' ? 'Approved' : 'Rejected'}
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
