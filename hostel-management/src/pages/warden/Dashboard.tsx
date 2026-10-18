import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MessageSquare, Users, BedDouble } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Button, Card, StatsCard } from '../../components/ui';
import { useAuth } from '../../context';
import { getHostels, getStudents, getRooms, getComplaints, getLeaveRequests, updateComplaintStatus, updateLeaveStatus } from '../../services';
import type { Complaint, LeaveRequest, Hostel, Room, Student } from '../../types';

export default function WardenDashboard() {
  const navigate = useNavigate();
  const { isConfigured } = useAuth();
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const hostelsResult = await getHostels();
    const assignedHostel = hostelsResult.data?.[0] || null;
    setHostel(assignedHostel);
    const [studentsResult, roomsResult, complaintsResult, leavesResult] = await Promise.all([
      getStudents(assignedHostel ? { hostelId: assignedHostel.id } : undefined),
      getRooms(assignedHostel?.id),
      getComplaints(),
      getLeaveRequests(),
    ]);
    const errors = [hostelsResult.error, studentsResult.error, roomsResult.error, complaintsResult.error, leavesResult.error].filter(Boolean);
    setErrorMessage(errors.length ? errors.join(' ') : null);
    setStudents(studentsResult.data || []);
    setRooms(roomsResult.data || []);
    setComplaints(complaintsResult.data || []);
    setLeaves(leavesResult.data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const changeComplaint = async (complaint: Complaint, status: Complaint['status']) => {
    const result = await updateComplaintStatus(complaint.id, status);
    if (result.error) setErrorMessage(result.error); else await load();
  };

  const decideLeave = async (request: LeaveRequest, status: 'approved' | 'rejected') => {
    const result = await updateLeaveStatus(request.id, status);
    if (result.error) setErrorMessage(result.error); else await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title={hostel ? `Warden Desk — ${hostel.name}` : 'Warden Desk'} description="Live operations for your assigned hostel" action={<Button size="sm" variant="outline" onClick={() => navigate('/warden/notices')}>Post Notice</Button>} />
      {!isConfigured && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Offline mode is active; live dashboard data is unavailable.</p>}
      {errorMessage && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading warden data...</p> : <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <StatsCard title="Residents" value={students.length} subtitle="Assigned hostel" icon={Users} iconColor="text-primary-600" iconBg="bg-primary-50" />
          <StatsCard title="Occupied Rooms" value={`${rooms.filter((room) => room.current_occupants > 0).length} / ${rooms.length}`} subtitle="Live occupancy" icon={BedDouble} iconColor="text-primary-600" iconBg="bg-primary-50" />
          <StatsCard title="Pending Complaints" value={complaints.filter((item) => item.status === 'pending').length} subtitle="Awaiting action" icon={MessageSquare} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <StatsCard title="Pending Leave" value={leaves.filter((item) => item.status === 'pending').length} subtitle="Awaiting decision" icon={Calendar} iconColor="text-rose-600" iconBg="bg-rose-50" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card><div className="flex justify-between mb-4"><h3 className="text-sm font-bold">Complaint Queue</h3><button className="text-xs text-primary-600" onClick={() => navigate('/warden/complaints')}>View all</button></div>{complaints.slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0"><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-gray-500">{item.category} · {item.status}</p></div><div className="flex gap-2">{item.status === 'pending' && <Button size="sm" variant="outline" onClick={() => void changeComplaint(item, 'in_progress')}>Start</Button>}{item.status === 'in_progress' && <Button size="sm" onClick={() => void changeComplaint(item, 'resolved')}>Resolve</Button>}{item.status === 'resolved' && <Badge variant="success">Resolved</Badge>}</div></div>)}{!complaints.length && <p className="text-sm text-gray-500">No complaints visible.</p>}</Card>
          <Card><div className="flex justify-between mb-4"><h3 className="text-sm font-bold">Leave Decisions</h3><button className="text-xs text-primary-600" onClick={() => navigate('/warden/leave')}>View all</button></div>{leaves.filter((item) => item.status === 'pending').slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0"><div><p className="text-sm font-medium">{item.reason}</p><p className="text-xs text-gray-500">{item.destination} · {item.start_date} to {item.end_date}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void decideLeave(item, 'rejected')}>Reject</Button><Button size="sm" onClick={() => void decideLeave(item, 'approved')}>Approve</Button></div></div>)}{!leaves.filter((item) => item.status === 'pending').length && <p className="text-sm text-gray-500">No pending leave requests.</p>}</Card>
        </div>
      </>}
    </div>
  );
}
