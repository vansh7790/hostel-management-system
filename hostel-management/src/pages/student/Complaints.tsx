import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Card, Button } from '../../components/ui';

export default function StudentComplaints() {
  const complaints = [
    { id: '1', title: 'Broken ceiling fan', category: 'Electrical', status: 'pending' as const, date: 'Sep 29, 2026' },
    { id: '2', title: 'Leaking bathroom tap', category: 'Plumbing', status: 'in_progress' as const, date: 'Sep 25, 2026' },
    { id: '3', title: 'Wi-Fi not working', category: 'Internet', status: 'resolved' as const, date: 'Sep 20, 2026' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="warning" dot>Pending</Badge>;
      case 'in_progress': return <Badge variant="info" dot>In Progress</Badge>;
      case 'resolved': return <Badge variant="success" dot>Resolved</Badge>;
      default: return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div>
      <PageHeader
        title="My Complaints"
        description="Submit and track your maintenance complaints."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New Complaint</Button>}
      />
      <div className="space-y-3">
        {complaints.map((c) => (
          <Card key={c.id} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{c.title}</p>
                <p className="text-sm text-gray-500">{c.category} · {c.date}</p>
              </div>
              {getStatusBadge(c.status)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
