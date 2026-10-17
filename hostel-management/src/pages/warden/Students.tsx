import { PageHeader } from '../../components/layout';
import { Card, Input } from '../../components/ui';
import { Search, User } from 'lucide-react';

export default function WardenStudents() {
  const students = [
    { name: 'John Doe', id: 'STU2024001', room: 'A-204', department: 'Computer Science' },
    { name: 'Rahul Kumar', id: 'STU2024015', room: 'A-204', department: 'Computer Science' },
    { name: 'Priya Sharma', id: 'STU2024023', room: 'A-301', department: 'Electronics' },
    { name: 'Amit Singh', id: 'STU2024042', room: 'A-105', department: 'Mechanical' },
  ];

  return (
    <div>
      <PageHeader title="Students" description="View all students in your hostel." />
      <div className="mb-6"><Input placeholder="Search students..." leftIcon={<Search className="h-4 w-4" />} /></div>
      <div className="space-y-3">
        {students.map((s) => (
          <Card key={s.id} padding="sm" hover>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><User className="h-5 w-5 text-gray-500" /></div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-500">{s.id} · {s.department}</p>
              </div>
              <span className="text-sm text-gray-500">Room {s.room}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
