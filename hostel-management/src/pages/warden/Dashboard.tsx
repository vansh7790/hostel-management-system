import {
  Users,
  BedDouble,
  MessageSquare,
  Calendar,
  AlertCircle,
  ArrowRight,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout';
import { StatsCard, Card, Badge, Button } from '../../components/ui';

export default function WardenDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Warden Desk — Hostel Mandakini"
        description="Daily operations overview · 128 residents · Wing A & B"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/warden/notices')}
            >
              Post Notice
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/warden/rooms')}
            >
              Check Occupancy
            </Button>
          </div>
        }
      />

      {/* Top 4 Key Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatsCard
          title="Total Residents"
          value={128}
          subtitle="Max Capacity: 140 Beds"
          icon={Users}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <StatsCard
          title="Occupied Rooms"
          value="58 / 64"
          subtitle="90.6% Room Occupancy"
          icon={BedDouble}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <StatsCard
          title="Pending Complaints"
          value={4}
          subtitle="2 High Priority"
          icon={MessageSquare}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatsCard
          title="Pending Gate Passes"
          value={3}
          subtitle="Awaiting Warden Sign-off"
          icon={Calendar}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
        />
      </div>

      {/* "What Needs My Attention?" Section */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">Requires Immediate Attention</h2>
          </div>
          <span className="text-xs text-gray-400">3 items pending decision</span>
        </div>

        <div className="space-y-3">
          {/* Urgent Item 1 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-rose-200/80 bg-rose-50/40">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700 mt-0.5">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-900">Medical Leave Request</span>
                  <Badge variant="danger">Urgent Gate Pass</Badge>
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  <strong>Aarav Sharma</strong> (Room B-204) — Family Medical Emergency to Jaipur
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Duration: Oct 2 (16:00) to Oct 4 (22:00) · Emergency Contact: +91 98765 01234
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:self-center">
              <Button size="sm" variant="outline" className="text-xs">
                Review Details
              </Button>
              <Button size="sm" className="text-xs">
                Approve Pass
              </Button>
            </div>
          </div>

          {/* Urgent Item 2 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-200/80 bg-amber-50/40">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-900">Overhead Tank Valve Leakage</span>
                  <Badge variant="warning">Maintenance Alert</Badge>
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  Reported in <strong>Wing B 2nd Floor</strong> washrooms · Affects Rooms 204 to 208
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Reported 2 hours ago by Amit Singh · Needs Plumber allocation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:self-center">
              <Button size="sm" variant="outline" className="text-xs">
                View Report
              </Button>
              <Button size="sm" className="text-xs">
                Assign Staff
              </Button>
            </div>
          </div>

          {/* Urgent Item 3 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-blue-200/80 bg-blue-50/40">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mt-0.5">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-900">Weekend Outstation Gate Pass</span>
                  <Badge variant="info">Standard Leave</Badge>
                </div>
                <p className="text-xs text-gray-700 mt-1">
                  <strong>Priya Verma</strong> (Room A-102) — Attending Inter-College Fest at Pune
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Duration: Oct 5 to Oct 8 · Guardian Approval Attached
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:self-center">
              <Button size="sm" variant="outline" className="text-xs">
                Reject
              </Button>
              <Button size="sm" className="text-xs">
                Approve
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Operational 2-Column Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Complaints Queue */}
        <Card>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Recent Complaints Queue</h3>
              <p className="text-xs text-gray-500">Student maintenance and repair reports</p>
            </div>
            <button
              onClick={() => navigate('/warden/complaints')}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              All Complaints <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                title: 'Ceiling fan regulator faulty',
                student: 'Aarav Sharma',
                room: 'Room B-204',
                cat: 'Electrical',
                status: 'in_progress',
                time: 'Today, 10:30 AM',
              },
              {
                title: 'Study desk drawer broken',
                student: 'Amit S.',
                room: 'Room A-105',
                cat: 'Furniture',
                status: 'pending',
                time: 'Yesterday',
              },
              {
                title: 'Bathroom tap washer worn out',
                student: 'Priya R.',
                room: 'Room A-301',
                cat: 'Plumbing',
                status: 'pending',
                time: 'Yesterday',
              },
              {
                title: 'Wi-Fi LAN port disconnected',
                student: 'Rohan Mehta',
                room: 'Room B-204',
                cat: 'Internet',
                status: 'resolved',
                time: 'Sep 29',
              },
            ].map((c) => (
              <div
                key={c.title + c.room}
                className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-900">{c.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {c.student} · <strong>{c.room}</strong> · {c.cat} · {c.time}
                  </p>
                </div>
                <Badge
                  variant={
                    c.status === 'resolved'
                      ? 'success'
                      : c.status === 'in_progress'
                      ? 'info'
                      : 'warning'
                  }
                  dot
                >
                  {c.status === 'in_progress' ? 'In Progress' : c.status === 'resolved' ? 'Resolved' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Leave Requests */}
        <Card>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Pending Gate Pass Requests</h3>
              <p className="text-xs text-gray-500">Student leave approvals and outstation logs</p>
            </div>
            <button
              onClick={() => navigate('/warden/leave')}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              All Passes <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                student: 'Aarav Sharma',
                room: 'B-204',
                destination: 'Jaipur',
                reason: 'Family Emergency',
                dates: 'Oct 2 - Oct 4',
                status: 'Urgent',
              },
              {
                student: 'Priya Verma',
                room: 'A-102',
                destination: 'Pune',
                reason: 'Inter-College Fest',
                dates: 'Oct 5 - Oct 8',
                status: 'Normal',
              },
              {
                student: 'Vikram Patel',
                room: 'B-112',
                destination: 'Ahmedabad',
                reason: 'Passport Interview',
                dates: 'Oct 10 - Oct 12',
                status: 'Normal',
              },
            ].map((l) => (
              <div
                key={l.student + l.dates}
                className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-900">{l.student}</p>
                    <span className="text-[10px] text-gray-400">({l.room})</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    To: <strong>{l.destination}</strong> · {l.reason} · {l.dates}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50">
                    Reject
                  </Button>
                  <Button size="sm" className="h-7 text-xs px-2.5">
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
