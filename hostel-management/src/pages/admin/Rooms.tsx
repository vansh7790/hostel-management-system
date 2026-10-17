import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Card, Badge, Button, Input } from '../../components/ui';

export default function AdminRooms() {
  const rooms = [
    { number: 'A-101', hostel: 'Hostel A', floor: 1, capacity: 3, occupants: 3, status: 'full' as const },
    { number: 'A-102', hostel: 'Hostel A', floor: 1, capacity: 3, occupants: 2, status: 'available' as const },
    { number: 'B-201', hostel: 'Hostel B', floor: 2, capacity: 2, occupants: 2, status: 'full' as const },
    { number: 'B-202', hostel: 'Hostel B', floor: 2, capacity: 2, occupants: 0, status: 'available' as const },
    { number: 'C-101', hostel: 'Hostel C', floor: 1, capacity: 3, occupants: 1, status: 'available' as const },
    { number: 'C-301', hostel: 'Hostel C', floor: 3, capacity: 2, occupants: 0, status: 'available' as const },
  ];

  return (
    <div>
      <PageHeader title="Rooms" description="Manage all rooms across hostels." action={<Button leftIcon={<Plus className="h-4 w-4" />}>Add Room</Button>} />
      <div className="mb-6"><Input placeholder="Search rooms..." leftIcon={<Search className="h-4 w-4" />} /></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((r) => (
          <Card key={r.number} hover>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">{r.number}</h3>
              <Badge variant={r.status === 'full' ? 'danger' : 'success'} dot>{r.status === 'full' ? 'Full' : 'Available'}</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Hostel</span><span className="font-medium">{r.hostel}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Floor</span><span className="font-medium">{r.floor}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Occupancy</span><span className="font-medium">{r.occupants}/{r.capacity}</span></div>
            </div>
            <div className="mt-3 bg-gray-100 rounded-full h-2"><div className="bg-primary-600 h-2 rounded-full" style={{ width: `${(r.occupants / r.capacity) * 100}%` }} /></div>
          </Card>
        ))}
      </div>
    </div>
  );
}
