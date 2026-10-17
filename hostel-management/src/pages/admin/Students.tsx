import { Plus, Search, User } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Card, Input, Button } from '../../components/ui';

export default function AdminStudents() {
  const students = [
    { name: 'John Doe', id: 'STU2024001', hostel: 'Hostel A', room: 'A-204', dept: 'CS', year: 3 },
    { name: 'Rahul Kumar', id: 'STU2024015', hostel: 'Hostel A', room: 'A-204', dept: 'CS', year: 3 },
    { name: 'Priya Sharma', id: 'STU2024023', hostel: 'Hostel C', room: 'C-301', dept: 'ECE', year: 2 },
    { name: 'Amit Singh', id: 'STU2024042', hostel: 'Hostel A', room: 'A-105', dept: 'ME', year: 4 },
    { name: 'Sarah Khan', id: 'STU2024056', hostel: 'Hostel C', room: 'C-102', dept: 'CS', year: 2 },
  ];

  return (
    <div>
      <PageHeader title="Students" description="Manage all students." action={<Button leftIcon={<Plus className="h-4 w-4" />}>Add Student</Button>} />
      <div className="mb-6"><Input placeholder="Search students..." leftIcon={<Search className="h-4 w-4" />} /></div>
      <div className="space-y-3">
        {students.map((s) => (
          <Card key={s.id} padding="sm" hover>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><User className="h-5 w-5 text-gray-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-500">{s.id} · {s.dept} · Year {s.year}</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{s.hostel}</p>
                <p className="text-sm text-gray-500">Room {s.room}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
