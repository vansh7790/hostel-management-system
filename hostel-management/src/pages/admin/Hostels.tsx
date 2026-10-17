import { Plus, Building2 } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Card, Badge, Button } from '../../components/ui';

export default function AdminHostels() {
  const hostels = [
    { name: 'Hostel Mandakini', type: 'Boys', rooms: 64, capacity: 140, students: 132, warden: 'Dr. R. K. Singh' },
    { name: 'Hostel Alakananda', type: 'Boys', rooms: 60, capacity: 130, students: 124, warden: 'Prof. M. K. Sharma' },
    { name: 'Hostel Kaveri', type: 'Girls', rooms: 68, capacity: 150, students: 140, warden: 'Dr. Sunita Rao' },
    { name: 'Hostel Yamuna', type: 'Girls', rooms: 60, capacity: 140, students: 112, warden: 'Prof. Anjali Gupta' },
  ];

  return (
    <div>
      <PageHeader
        title="Hostels Directory"
        description="Campus residential buildings, block capacities, and assigned wardens."
        action={<Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>Add Hostel</Button>}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        {hostels.map((h) => {
          const occupancyPct = Math.round((h.students / h.capacity) * 100);
          return (
            <Card key={h.name} hover>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 text-primary-600 border border-primary-100">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-sm">{h.name}</h3>
                    <Badge variant={h.type === 'Boys' ? 'info' : 'default'}>{h.type}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Warden: {h.warden}</p>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div>
                      <span className="text-gray-500">Rooms: </span>
                      <span className="font-semibold text-gray-800">{h.rooms}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Residents: </span>
                      <span className="font-semibold text-gray-800">{h.students} / {h.capacity}</span>
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span>Occupancy</span>
                      <span className="font-medium text-gray-700">{occupancyPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary-600 h-1.5 rounded-full" style={{ width: `${occupancyPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
