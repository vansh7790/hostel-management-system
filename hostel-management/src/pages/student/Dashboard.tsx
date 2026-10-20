import { useEffect, useState } from 'react';
import { BedDouble, Bell, Calendar, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout';
import { Badge, Card, StatsCard } from '../../components/ui';
import { useAuth } from '../../context';
import { getComplaints, getLeaveRequests, getNotices, getStudentByUserId } from '../../services';
import type { Complaint, LeaveRequest, Notice, Student } from '../../types';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [studentRecordUnavailable, setStudentRecordUnavailable] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const studentResult = await getStudentByUserId(user.id);
      if (studentResult.error || !studentResult.data) {
        setStudentRecordUnavailable(true);
        setErrorMessage(studentResult.error
          ? `Could not load the student record linked to this account: ${studentResult.error}`
          : null);
        setLoading(false);
        return;
      }
      const currentStudent = studentResult.data;
      setStudent(currentStudent);
      const [complaintResult, leaveResult, noticeResult] = await Promise.all([
        getComplaints({ studentId: currentStudent.id }),
        getLeaveRequests({ studentId: currentStudent.id }),
        getNotices(currentStudent.hostel_id),
      ]);
      const errors = [complaintResult.error, leaveResult.error, noticeResult.error].filter(Boolean);
      if (errors.length) setErrorMessage(errors.join(' '));
      setComplaints(complaintResult.data || []);
      setLeaves(leaveResult.data || []);
      setNotices(noticeResult.data || []);
      setLoading(false);
    };
    void load();
  }, [user]);

  const pendingComplaints = complaints.filter((item) => item.status !== 'resolved').length;
  const activeLeave = leaves.find((item) => item.status === 'pending' || item.status === 'approved');

  return (
    <div className="space-y-6">
      <PageHeader title={student ? `Welcome back, ${student.name}!` : 'Student Dashboard'} description={student?.hostel_id && student.room_id ? 'Your live hostel allocation and requests' : 'Your hostel services overview'} />
      {errorMessage && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading your dashboard...</p> : studentRecordUnavailable ? <Card><h2 className="font-semibold text-gray-900">Student registration is pending</h2><p className="mt-2 text-sm text-gray-600">A login account and a student record are separate. Ask the hostel administrator to create or verify your student record, including your email and student ID. After you confirm your email, one exact matching record is linked automatically. If the record is missing or details are ambiguous, the administrator must correct it.</p></Card> : <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <StatsCard title="Room Assigned" value={student?.room?.room_number || 'Unassigned'} subtitle={student?.actual_hostel?.name || 'No hostel assigned'} icon={BedDouble} iconColor="text-primary-600" iconBg="bg-primary-50" />
          <StatsCard title="Active Complaints" value={pendingComplaints} subtitle="Not resolved" icon={MessageSquare} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <StatsCard title="Leave Status" value={activeLeave?.status || 'None'} subtitle={activeLeave ? `${activeLeave.start_date} to ${activeLeave.end_date}` : 'No active request'} icon={Calendar} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
          <StatsCard title="Notices" value={notices.length} subtitle="Visible to you" icon={Bell} iconColor="text-blue-600" iconBg="bg-blue-50" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Recent Requests</h3><button className="text-xs text-primary-600" onClick={() => navigate('/student/complaints')}>View complaints</button></div>{complaints.slice(0, 3).map((item) => <div key={item.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0"><span className="text-sm text-gray-700">{item.title}</span><Badge variant={item.status === 'resolved' ? 'success' : 'warning'}>{item.status}</Badge></div>)}{!complaints.length && <p className="text-sm text-gray-500">No complaints yet.</p>}</Card>
          <Card><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Latest Notices</h3><button className="text-xs text-primary-600" onClick={() => navigate('/student/notices')}>View all</button></div>{notices.slice(0, 3).map((notice) => <div key={notice.id} className="py-2 border-b border-gray-100 last:border-0"><p className="text-sm font-medium text-gray-900">{notice.title}</p><p className="text-xs text-gray-500 mt-1">{notice.description}</p></div>)}{!notices.length && <p className="text-sm text-gray-500">No notices available.</p>}</Card>
        </div>
      </>}
    </div>
  );
}
