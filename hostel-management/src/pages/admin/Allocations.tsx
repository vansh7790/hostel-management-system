import { PageHeader } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import { Plus, ArrowRight } from 'lucide-react';

export default function AdminAllocations() {
  const allocations = [
    { student: 'John Doe', from: 'Unallocated', to: 'A-204', date: 'Aug 15, 2026' },
    { student: 'Priya Sharma', from: 'C-102', to: 'C-301', date: 'Sep 1, 2026' },
    { student: 'Vikram P.', from: 'Unallocated', to: 'B-205', date: 'Sep 28, 2026' },
  ];

  return (
    <div>
      <PageHeader title="Room Allocations" description="Manage student room allocations." action={<Button leftIcon={<Plus className="h-4 w-4" />}>New Allocation</Button>} />
      <div className="space-y-3">
        {allocations.map((a) => (
          <Card key={a.student + a.date} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-medium text-gray-900">{a.student}</p>
                  <p className="text-sm text-gray-500">{a.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">{a.from}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-primary-600">{a.to}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
