import {
  Building2,
  BedDouble,
  MessageSquare,
  Calendar,
  GraduationCap,
  Users,
  ArrowRight,
  Plus,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout';
import { StatsCard, Card, Button } from '../../components/ui';

interface HostelCapacity {
  name: string;
  type: 'Boys' | 'Girls';
  warden: string;
  occupied: number;
  capacity: number;
  rooms: number;
  availableBeds: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const hostels: HostelCapacity[] = [
    {
      name: 'Hostel Mandakini',
      type: 'Boys',
      warden: 'Dr. R. K. Singh',
      occupied: 132,
      capacity: 140,
      rooms: 64,
      availableBeds: 8,
    },
    {
      name: 'Hostel Alakananda',
      type: 'Boys',
      warden: 'Prof. M. K. Sharma',
      occupied: 124,
      capacity: 130,
      rooms: 60,
      availableBeds: 6,
    },
    {
      name: 'Hostel Kaveri',
      type: 'Girls',
      warden: 'Dr. Sunita Rao',
      occupied: 140,
      capacity: 150,
      rooms: 68,
      availableBeds: 10,
    },
    {
      name: 'Hostel Yamuna',
      type: 'Girls',
      warden: 'Prof. Anjali Gupta',
      occupied: 112,
      capacity: 140,
      rooms: 60,
      availableBeds: 28,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Campus Administration Console"
        description="Centralized hostel occupancy, student directory, and maintenance overview"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin/allocations')}
            >
              Allocate Room
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/admin/students')}
            >
              Add Student
            </Button>
          </div>
        }
      />

      {/* 6 Key Campus Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatsCard
          title="Total Students"
          value={508}
          subtitle="Registered residents"
          icon={GraduationCap}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <StatsCard
          title="Hostel Blocks"
          value={4}
          subtitle="2 Boys · 2 Girls"
          icon={Building2}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <StatsCard
          title="Total Rooms"
          value={252}
          subtitle="560 Bed Capacity"
          icon={BedDouble}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <StatsCard
          title="Occupied Beds"
          value="508 / 560"
          subtitle="90.7% Occupied"
          icon={Users}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatsCard
          title="Complaints"
          value={14}
          subtitle="3 Needs Attention"
          icon={MessageSquare}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatsCard
          title="Active Leave"
          value={18}
          subtitle="Campus Outstation"
          icon={Calendar}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
      </div>

      {/* Main Grid: Hostel Occupancy (Left) & Recent Activity (Right) */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left Column: Hostel Occupancy (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Hostel Occupancy & Capacity</h3>
                <p className="text-xs text-gray-500">Live resident distribution across campus hostel buildings</p>
              </div>
              <button
                onClick={() => navigate('/admin/hostels')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                Hostel Details <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {hostels.map((h) => {
                const percentage = Math.round((h.occupied / h.capacity) * 100);
                const isNearFull = percentage >= 92;

                return (
                  <div
                    key={h.name}
                    className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900">{h.name}</h4>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              h.type === 'Boys'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                            }`}
                          >
                            {h.type} Hostel
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Warden: {h.warden} · {h.rooms} Rooms
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-gray-900">
                          {h.occupied} / {h.capacity}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">students</span>
                        <p
                          className={`text-[11px] font-medium mt-0.5 ${
                            isNearFull ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          {percentage}% occupied ({h.availableBeds} beds vacant)
                        </p>
                      </div>
                    </div>

                    {/* Occupancy Progress Bar */}
                    <div className="w-full bg-gray-200/80 rounded-full h-2 overflow-hidden mt-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isNearFull ? 'bg-amber-500' : 'bg-primary-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Action Matrix for Admin */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/admin/allocations')}
              className="p-3 rounded-xl border border-gray-200/80 bg-white hover:border-primary-300 hover:shadow-xs transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-2 group-hover:bg-primary-100">
                <BedDouble className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-gray-900">Room Allocations</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Assign & transfer</p>
            </button>

            <button
              onClick={() => navigate('/admin/fees')}
              className="p-3 rounded-xl border border-gray-200/80 bg-white hover:border-primary-300 hover:shadow-xs transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:bg-emerald-100">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-gray-900">Fee Accounts</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Hostel dues & receipts</p>
            </button>

            <button
              onClick={() => navigate('/admin/notices')}
              className="p-3 rounded-xl border border-gray-200/80 bg-white hover:border-primary-300 hover:shadow-xs transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:bg-purple-100">
                <Building2 className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-gray-900">Announcements</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Publish campus notice</p>
            </button>
          </div>
        </div>

        {/* Right Column: Recent Activity (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary-600" />
                <h3 className="text-sm font-bold text-gray-900">Recent Campus Activity</h3>
              </div>
              <span className="text-[11px] text-gray-400">Live feed</span>
            </div>

            <div className="space-y-3.5">
              {[
                {
                  event: 'Outstation Gate Pass Approved',
                  detail: 'Aarav Sharma (Mandakini B-204) approved for Jaipur visit',
                  time: '25 mins ago',
                  category: 'Leave',
                },
                {
                  event: 'Room Allocation Completed',
                  detail: 'Devendra Rao assigned to Hostel Alakananda (Room 102)',
                  time: '1 hour ago',
                  category: 'Allocation',
                },
                {
                  event: 'Maintenance Ticket Resolved',
                  detail: 'Wi-Fi switch port fixed in Hostel Kaveri 3rd Floor',
                  time: '2 hours ago',
                  category: 'Complaint',
                },
                {
                  event: 'Campus Notice Broadcasted',
                  detail: 'Overhead water tank cleaning circular published',
                  time: '4 hours ago',
                  category: 'Notice',
                },
                {
                  event: 'Hostel Fee Clearance Recorded',
                  detail: 'Rohan Mehta cleared Semester 5 hostel and mess dues',
                  time: '6 hours ago',
                  category: 'Fee',
                },
              ].map((activity) => (
                <div
                  key={activity.event + activity.time}
                  className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                      {activity.category}
                    </span>
                    <span className="text-[10px] text-gray-400">{activity.time}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 mt-1">{activity.event}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{activity.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
