import { PageHeader } from '../../components/layout';
import { Card, Badge } from '../../components/ui';
import { User, CheckCircle2 } from 'lucide-react';

export default function StudentRoom() {
  const roomInventory = [
    '2 Wooden Study Desks with Chairs',
    '2 Single Metal Frame Beds with Mattresses',
    '2 Built-in Steel Wardrobes',
    '1 High-Speed Gigabit LAN Port (Active)',
    '1 Ceiling Fan with 5-Step Regulator',
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Room Allocation"
        description="Assigned accommodation details, roommate info, and room inventory."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Room Info */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Room Specifications</h3>
              <p className="text-xs text-gray-500">Allocated for Academic Year 2026-27</p>
            </div>
            <Badge variant="success" dot>Active Allocation</Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-gray-400 block mb-1">Hostel Block</span>
              <span className="font-semibold text-gray-900 text-sm">Hostel Mandakini (Boys)</span>
              <span className="text-gray-500 block text-[11px] mt-0.5">Wing B · Sector North</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-gray-400 block mb-1">Room Number</span>
              <span className="font-semibold text-gray-900 text-sm">B-204</span>
              <span className="text-gray-500 block text-[11px] mt-0.5">Floor 2 (Corner East)</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-gray-400 block mb-1">Occupancy Type</span>
              <span className="font-semibold text-gray-900 text-sm">Double Sharing</span>
              <span className="text-gray-500 block text-[11px] mt-0.5">Capacity: 2 Students</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-gray-400 block mb-1">Resident Warden</span>
              <span className="font-semibold text-gray-900 text-sm">Dr. R. K. Singh</span>
              <span className="text-gray-500 block text-[11px] mt-0.5">Contact: +91 98765 43210</span>
            </div>
          </div>

          {/* Room Inventory */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-900 mb-3">Room Fixtures & Inventory</h4>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {roomInventory.map((item) => (
                <div key={item} className="flex items-center gap-2 text-gray-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Roommate Info */}
        <div className="space-y-6">
          <Card>
            <div className="pb-3 mb-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Roommate</h3>
              <p className="text-xs text-gray-500">Co-occupant of Room B-204</p>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Rohan Sharma</p>
                  <p className="text-xs text-gray-500">Roll: 2024CS042</p>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-gray-200/60 text-xs space-y-1.5 text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Department:</span>
                  <span className="font-medium text-gray-800">Computer Science</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Year:</span>
                  <span className="font-medium text-gray-800">3rd Year (Sem 5)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Bed Allocation:</span>
                  <span className="font-medium text-gray-800">Bed 2 (Window side)</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
