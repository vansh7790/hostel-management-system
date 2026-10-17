import { PageHeader } from '../../components/layout';
import { Badge, Card } from '../../components/ui';

export default function StudentFees() {
  const fees = [
    { semester: 'Fall 2026', amount: '₹45,000', due: 'Oct 15, 2026', status: 'pending' as const },
    { semester: 'Spring 2026', amount: '₹45,000', due: 'Mar 15, 2026', status: 'paid' as const },
    { semester: 'Fall 2025', amount: '₹42,000', due: 'Oct 15, 2025', status: 'paid' as const },
  ];

  return (
    <div>
      <PageHeader title="Fee Information" description="View your hostel fee details and payment status." />
      <div className="space-y-3">
        {fees.map((f) => (
          <Card key={f.semester} padding="sm" hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{f.semester}</p>
                <p className="text-sm text-gray-500">{f.amount} · Due: {f.due}</p>
              </div>
              <Badge variant={f.status === 'paid' ? 'success' : 'warning'} dot>{f.status === 'paid' ? 'Paid' : 'Pending'}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
