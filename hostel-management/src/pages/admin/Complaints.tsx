import { PageHeader } from '../../components/layout';
import { Card, Badge, Input } from '../../components/ui';
import { Search } from 'lucide-react';

export default function AdminComplaints() {
  const complaints = [
    { id: '1', title: 'Broken ceiling fan', category: 'Electrical', student: 'John Doe', hostel: 'Hostel A', room: 'A-204', status: 'pending' as const, date: 'Sep 29, 2026' },
    { id: '2', title: 'Water leakage', category: 'Plumbing', student: 'Priya S.', hostel: 'Hostel C', room: 'C-301', status: 'in_progress' as const, date: 'Sep 27, 2026' },
    { id: '3', title: 'No hot water', category: 'Plumbing', student: 'Rahul K.', hostel: 'Hostel A', room: 'A-204', status: 'pending' as const, date: 'Sep 26, 2026' },
    { id: '4', title: 'Wi-Fi issue', category: 'Internet', student: 'Amit S.', hostel: 'Hostel B', room: 'B-201', status: 'resolved' as const, date: 'Sep 20, 2026' },
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
      <PageHeader title="All Complaints" description="View and manage complaints across all hostels." />
      <div className="mb-6"><Input placeholder="Search complaints..." leftIcon={<Search className="h-4 w-4" />} /></div>
      <div className="space-y-3">
        {complaints.map((c) => (
          <Card key={c.id} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{c.title}</p>
                <p className="text-sm text-gray-500">{c.category} · {c.student} · {c.hostel} · Room {c.room} · {c.date}</p>
              </div>
              {getStatusBadge(c.status)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
