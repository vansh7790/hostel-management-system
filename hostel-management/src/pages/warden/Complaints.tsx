import { PageHeader } from '../../components/layout';
import { Card, Badge } from '../../components/ui';

export default function WardenComplaints() {
  const complaints = [
    { id: '1', title: 'Broken ceiling fan', category: 'Electrical', student: 'John Doe', room: 'A-204', status: 'pending' as const, date: 'Sep 29, 2026' },
    { id: '2', title: 'Water leakage', category: 'Plumbing', student: 'Priya S.', room: 'A-301', status: 'in_progress' as const, date: 'Sep 27, 2026' },
    { id: '3', title: 'Desk broken', category: 'Furniture', student: 'Amit S.', room: 'A-105', status: 'pending' as const, date: 'Sep 26, 2026' },
    { id: '4', title: 'Wi-Fi not working', category: 'Internet', student: 'Rahul K.', room: 'A-204', status: 'resolved' as const, date: 'Sep 20, 2026' },
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
      <PageHeader title="Complaints" description="Manage student complaints." />
      <div className="space-y-3">
        {complaints.map((c) => (
          <Card key={c.id} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{c.title}</p>
                <p className="text-sm text-gray-500">{c.category} · {c.student} · Room {c.room} · {c.date}</p>
              </div>
              {getStatusBadge(c.status)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
