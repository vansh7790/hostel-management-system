import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Button, Card, Input, Modal, Textarea } from '../../components/ui';
import { useAuth } from '../../context';
import { createLeaveRequest, getLeaveRequests, getStudentByUserId } from '../../services';
import type { LeaveRequest, Student } from '../../types';

export default function StudentLeave() {
  const { user, isConfigured } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    const studentResult = await getStudentByUserId(user.id);
    if (studentResult.error || !studentResult.data) {
      setErrorMessage(studentResult.error || 'Your student record is not available yet.');
      setLoading(false);
      return;
    }
    setStudent(studentResult.data);
    const leaveResult = await getLeaveRequests({ studentId: studentResult.data.id });
    if (leaveResult.error) setErrorMessage(leaveResult.error);
    setRequests(leaveResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!student || !reason.trim() || !destination.trim() || !startDate || !endDate || !emergencyContact.trim()) return;
    if (endDate < startDate) {
      setErrorMessage('End date must be on or after the start date.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    const result = await createLeaveRequest({
      student_id: student.id,
      reason: reason.trim(),
      destination: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      emergency_contact: emergencyContact.trim(),
      message: message.trim() || undefined,
    });
    setSaving(false);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    setReason('');
    setDestination('');
    setStartDate('');
    setEndDate('');
    setEmergencyContact('');
    setMessage('');
    setIsOpen(false);
    await loadData();
  };

  const statusBadge = (status: LeaveRequest['status']) => (
    <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'} dot>
      {status[0].toUpperCase() + status.slice(1)}
    </Badge>
  );

  return (
    <div>
      <PageHeader title="Leave Requests" description="Apply for leave and track your request status." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsOpen(true)} disabled={!isConfigured}>Apply Leave</Button>} />
      {!isConfigured && <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Connect Supabase to submit live leave requests.</p>}
      {errorMessage && <p className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading leave requests...</p> : requests.length === 0 ? <Card><p className="text-sm text-gray-500">No leave requests submitted yet.</p></Card> : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} padding="sm" hover>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{request.reason}</p>
                  <p className="text-sm text-gray-500">{request.destination} · {request.start_date} to {request.end_date}</p>
                  {request.remark && <p className="text-xs text-gray-500 mt-1">Remark: {request.remark}</p>}
                </div>
                {statusBadge(request.status)}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Apply for Leave" footer={<><Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button><Button type="submit" form="leave-form" isLoading={saving}>Submit Request</Button></>}>
        <form id="leave-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
          <Input label="Destination" value={destination} onChange={(event) => setDestination(event.target.value)} required />
          <div className="grid grid-cols-2 gap-3"><Input label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /><Input label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div>
          <Input label="Emergency contact" value={emergencyContact} onChange={(event) => setEmergencyContact(event.target.value)} required />
          <Textarea label="Message (optional)" value={message} onChange={(event) => setMessage(event.target.value)} />
        </form>
      </Modal>
    </div>
  );
}
