import { PageHeader } from '../../components/layout';
import { Card, Badge, Input } from '../../components/ui';
import { Search } from 'lucide-react';

export default function AdminFees() {
  const fees = [
    { student: 'John Doe', id: 'STU2024001', semester: 'Fall 2026', amount: '₹45,000', due: 'Oct 15, 2026', status: 'pending' as const },
    { student: 'Rahul Kumar', id: 'STU2024015', semester: 'Fall 2026', amount: '₹45,000', due: 'Oct 15, 2026', status: 'paid' as const },
    { student: 'Priya Sharma', id: 'STU2024023', semester: 'Fall 2026', amount: '₹45,000', due: 'Oct 15, 2026', status: 'overdue' as const },
  ];

  return (
    <div>
      <PageHeader title="Fee Management" description="View and manage student fee records." />
      <div className="mb-6"><Input placeholder="Search students..." leftIcon={<Search className="h-4 w-4" />} /></div>
      <div className="space-y-3">
        {fees.map((f) => (
          <Card key={f.id + f.semester} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{f.student}</p>
                <p className="text-sm text-gray-500">{f.id} · {f.semester} · {f.amount} · Due: {f.due}</p>
              </div>
              <Badge variant={f.status === 'paid' ? 'success' : f.status === 'overdue' ? 'danger' : 'warning'} dot>
                {f.status === 'paid' ? 'Paid' : f.status === 'overdue' ? 'Overdue' : 'Pending'}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
