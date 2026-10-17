import { Plus, Bell } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Card, Button } from '../../components/ui';

export default function WardenNotices() {
  const notices = [
    { id: '1', title: 'Water Supply Maintenance', description: 'Water supply will be interrupted on Oct 2.', priority: 'high' as const, date: 'Oct 1, 2026' },
    { id: '2', title: 'Hostel Timings Update', description: 'New hostel entry timings effective immediately.', priority: 'medium' as const, date: 'Sep 28, 2026' },
  ];

  return (
    <div>
      <PageHeader
        title="Notices"
        description="Create and manage hostel notices."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New Notice</Button>}
      />
      <div className="space-y-4">
        {notices.map((n) => (
          <Card key={n.id} hover>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0"><Bell className="h-5 w-5 text-primary-600" /></div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900">{n.title}</h3>
                  <Badge variant={n.priority === 'high' ? 'danger' : 'warning'} dot>{n.priority}</Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.description}</p>
                <p className="text-xs text-gray-400 mt-2">{n.date}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
