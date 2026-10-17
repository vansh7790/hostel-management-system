import {
  BedDouble,
  MessageSquare,
  Calendar,
  DollarSign,
  Bell,
  ArrowRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  User,
  ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout';
import { Card, Badge, StatsCard, Button } from '../../components/ui';

export default function StudentDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Welcome back, Aarav!"
        description="Hostel Mandakini · Room B-204 · 3rd Year Computer Science"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="success" dot>Resident Active</Badge>
          </div>
        }
      />

      {/* 4 Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatsCard
          title="Room Assigned"
          value="B-204"
          subtitle="Hostel Mandakini · 2nd Fl."
          icon={BedDouble}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <StatsCard
          title="Active Complaints"
          value="1"
          subtitle="1 in progress"
          icon={MessageSquare}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatsCard
          title="Gate Pass / Leave"
          value="Approved"
          subtitle="Valid Oct 3 - Oct 6"
          icon={Calendar}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatsCard
          title="Fee Status"
          value="Paid"
          subtitle="Semester 5 cleared"
          icon={DollarSign}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate('/student/complaints')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-primary-50 hover:border-primary-200 text-gray-700 hover:text-primary-700 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-primary-600 group-hover:border-primary-300">
              <PlusCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">Raise Complaint</p>
              <p className="text-[10px] text-gray-400">Maintenance & repair</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/student/leave')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-primary-50 hover:border-primary-200 text-gray-700 hover:text-primary-700 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-primary-600 group-hover:border-primary-300">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">Apply for Leave</p>
              <p className="text-[10px] text-gray-400">Outstation gate pass</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/student/room')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-primary-50 hover:border-primary-200 text-gray-700 hover:text-primary-700 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-primary-600 group-hover:border-primary-300">
              <BedDouble className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">View Room</p>
              <p className="text-[10px] text-gray-400">Roommates & inventory</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/student/fees')}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-primary-50 hover:border-primary-200 text-gray-700 hover:text-primary-700 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-primary-600 group-hover:border-primary-300">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">View Fees</p>
              <p className="text-[10px] text-gray-400">Hostel & mess receipts</p>
            </div>
          </button>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Where am I staying? */}
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Accommodation Overview</h3>
                <p className="text-xs text-gray-500">Your current room allocation details</p>
              </div>
              <button
                onClick={() => navigate('/student/room')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                Full Room Info <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-gray-50/70 p-3.5 rounded-lg border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Hostel & Room</span>
                <p className="text-base font-bold text-gray-900 mt-1">Hostel Mandakini</p>
                <p className="text-xs text-gray-600">Room B-204 · Floor 2 · Wing B</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Badge variant="default">Double Occupancy</Badge>
                  <span className="text-xs text-gray-500">2 Beds Allocated</span>
                </div>
              </div>

              <div className="bg-gray-50/70 p-3.5 rounded-lg border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Roommate</span>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Rohan Sharma</p>
                    <p className="text-xs text-gray-500">Roll No: 2024CS042 · CSE</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Warden: Dr. R. K. Singh (Admin Office)</p>
              </div>
            </div>
          </Card>

          {/* Do I have anything pending? (My Active Requests) */}
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">My Recent Requests</h3>
                <p className="text-xs text-gray-500">Track status of your complaints and gate passes</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/student/complaints')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
                >
                  Complaints
                </button>
                <span className="text-gray-300">·</span>
                <button
                  onClick={() => navigate('/student/leave')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
                >
                  Leave Passes
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between p-3 rounded-lg border border-amber-100 bg-amber-50/30">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-900">Ceiling fan speed regulator replacement</p>
                      <Badge variant="warning" dot>In Progress</Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">Electrical Complaint · Room B-204 · Assigned to Electrician Ramu</p>
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap hidden sm:block">Reported Oct 1</span>
              </div>

              <div className="flex items-start justify-between p-3 rounded-lg border border-emerald-100 bg-emerald-50/30">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-900">Weekend Leave to Jaipur (Family Visit)</p>
                      <Badge variant="success" dot>Approved</Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">Gate Pass #GP-2026-881 · Valid Oct 3 (17:00) to Oct 6 (20:00)</p>
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap hidden sm:block">Approved by Warden</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Notices & Info (1 span) */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary-600" />
                <h3 className="text-sm font-bold text-gray-900">Hostel Notices</h3>
              </div>
              <button
                onClick={() => navigate('/student/notices')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="space-y-3.5">
              {[
                {
                  title: 'Water Supply Maintenance',
                  desc: 'Overhead tank cleaning scheduled for Oct 2 (09:00 AM - 01:00 PM). Please store water accordingly.',
                  priority: 'high' as const,
                  date: 'Oct 1, 2026',
                  author: 'Chief Warden',
                },
                {
                  title: 'Revised Hostel Gate Timings',
                  desc: 'All residents must report inside campus gates before 10:00 PM on weekdays.',
                  priority: 'medium' as const,
                  date: 'Sep 29, 2026',
                  author: 'Hostel Office',
                },
                {
                  title: 'Wi-Fi Speed Upgrade in Wing B',
                  desc: 'New access points deployed on 2nd and 3rd floors for enhanced speed.',
                  priority: 'low' as const,
                  date: 'Sep 26, 2026',
                  author: 'IT Cell',
                },
              ].map((notice) => (
                <div key={notice.title} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-gray-900 leading-snug">{notice.title}</p>
                    <Badge
                      variant={
                        notice.priority === 'high' ? 'danger' : notice.priority === 'medium' ? 'warning' : 'default'
                      }
                    >
                      {notice.priority}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">{notice.desc}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/50 text-[10px] text-gray-400">
                    <span>{notice.author}</span>
                    <span>{notice.date}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => navigate('/student/notices')}
              >
                Open Notice Board
              </Button>
            </div>
          </Card>

          {/* Quick Help Card */}
          <div className="bg-primary-50/60 rounded-xl border border-primary-100 p-4">
            <div className="flex items-center gap-2 text-primary-800 text-xs font-semibold mb-1">
              <ShieldAlert className="h-4 w-4" />
              <span>Hostel Security & Emergency</span>
            </div>
            <p className="text-[11px] text-primary-700 leading-relaxed">
              Main Gate Security Desk: <strong>Ext. 104</strong>
              <br />
              Warden Emergency Contact: <strong>+91 98765 43210</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
