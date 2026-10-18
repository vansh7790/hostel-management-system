import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Building2, Calendar, GraduationCap, MessageSquare, Plus, Users } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Card, StatsCard, Button } from '../../components/ui';
import { useAuth } from '../../context';
import { getComplaints, getHostels, getLeaveRequests, getRooms, getStudents } from '../../services';
import type { Hostel, Room } from '../../types';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isConfigured } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [complaintCount, setComplaintCount] = useState(0);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setErrorMessage(null);
      const [hostelsResult, roomsResult, studentsResult, complaintsResult, leaveResult] = await Promise.all([
        getHostels(), getRooms(), getStudents(), getComplaints({ status: 'pending' }), getLeaveRequests({ status: 'pending' }),
      ]);
      const errors = [hostelsResult.error, roomsResult.error, studentsResult.error, complaintsResult.error, leaveResult.error].filter(Boolean);
      if (errors.length) {
        setErrorMessage(errors.join(' '));
        setLoading(false);
        return;
      }
      setHostels(hostelsResult.data || []);
      setRooms(roomsResult.data || []);
      setStudentCount(studentsResult.data?.length || 0);
      setComplaintCount(complaintsResult.data?.length || 0);
      setPendingLeaveCount(leaveResult.data?.length || 0);
      setLoading(false);
    };
    void loadDashboard();
  }, [reloadCount]);

  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
  const occupiedBeds = rooms.reduce((sum, room) => sum + room.current_occupants, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Campus Administration Console" description="Live hostel occupancy, students, rooms, and request overview" action={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => navigate('/admin/allocations')}>Allocate Room</Button><Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/admin/students')}>Add Student</Button></div>} />
      {!isConfigured && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Offline mode is active; live dashboard data is unavailable.</p>}
      {loading ? <p className="text-sm text-gray-500">Loading administration data...</p> : errorMessage ? (
        <Card>
          <p role="alert" className="text-sm text-rose-700">Dashboard data could not be loaded, so counts are unavailable. {errorMessage}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setReloadCount((count) => count + 1)}>Retry</Button>
        </Card>
      ) : <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4"><StatsCard title="Students" value={studentCount} subtitle="Registered records" icon={GraduationCap} iconColor="text-primary-600" iconBg="bg-primary-50" /><StatsCard title="Hostels" value={hostels.length} subtitle="Visible blocks" icon={Building2} iconColor="text-primary-600" iconBg="bg-primary-50" /><StatsCard title="Rooms" value={rooms.length} subtitle={`${totalCapacity} bed capacity`} icon={BedDouble} iconColor="text-primary-600" iconBg="bg-primary-50" /><StatsCard title="Occupied Beds" value={`${occupiedBeds} / ${totalCapacity}`} subtitle="Database occupancy" icon={Users} iconColor="text-emerald-600" iconBg="bg-emerald-50" /><StatsCard title="Complaints" value={complaintCount} subtitle="Pending" icon={MessageSquare} iconColor="text-amber-600" iconBg="bg-amber-50" /><StatsCard title="Leave" value={pendingLeaveCount} subtitle="Pending" icon={Calendar} iconColor="text-blue-600" iconBg="bg-blue-50" /></div>
        <Card><div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-gray-900">Hostel Occupancy</h3><p className="text-xs text-gray-500">Calculated from rooms and student allocations</p></div><button onClick={() => navigate('/admin/hostels')} className="text-xs text-primary-600">Hostel Details</button></div><div className="space-y-4">{hostels.map((hostel) => { const hostelRooms = rooms.filter((room) => room.hostel_id === hostel.id); const capacity = hostelRooms.reduce((sum, room) => sum + room.capacity, 0); const occupied = hostelRooms.reduce((sum, room) => sum + room.current_occupants, 0); const percentage = capacity ? Math.round((occupied / capacity) * 100) : 0; return <div key={hostel.id}><div className="flex justify-between text-sm"><span className="font-medium">{hostel.name}</span><span className="text-gray-500">{occupied} / {capacity} beds ({percentage}%)</span></div><div className="w-full bg-gray-100 rounded-full h-2 mt-2"><div className="bg-primary-600 h-2 rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} /></div></div>; })}{!hostels.length && <p className="text-sm text-gray-500">No hostels visible.</p>}</div></Card>
      </>}
    </div>
  );
}
