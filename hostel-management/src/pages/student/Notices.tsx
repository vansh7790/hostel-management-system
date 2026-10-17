import { PageHeader } from '../../components/layout';
import { Badge, Card } from '../../components/ui';
import { Bell } from 'lucide-react';

export default function StudentNotices() {
  const notices = [
    { id: '1', title: 'Water Supply Maintenance', description: 'Water supply will be interrupted on Oct 2 from 10 AM to 2 PM for maintenance work.', priority: 'high' as const, date: 'Oct 1, 2026', by: 'Warden Singh' },
    { id: '2', title: 'Hostel Timings Update', description: 'New hostel entry timings: Gates close at 10:30 PM instead of 10 PM effective immediately.', priority: 'medium' as const, date: 'Sep 28, 2026', by: 'Admin' },
    { id: '3', title: 'Wi-Fi Upgrade Notice', description: 'Wi-Fi infrastructure upgrade scheduled for next weekend. Expect intermittent connectivity.', priority: 'low' as const, date: 'Sep 25, 2026', by: 'Admin' },
  ];

  return (
    <div>
      <PageHeader title="Notices" description="Important hostel announcements and updates." />
      <div className="space-y-4">
        {notices.map((n) => (
          <Card key={n.id} hover>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{n.title}</h3>
                  <Badge variant={n.priority === 'high' ? 'danger' : n.priority === 'medium' ? 'warning' : 'default'} dot>
                    {n.priority}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.description}</p>
                <p className="text-xs text-gray-400 mt-2">Posted by {n.by} · {n.date}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
