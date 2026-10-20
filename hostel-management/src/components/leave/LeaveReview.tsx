import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge, Button, Card, Input } from '../ui';
import { getLeaveRequests, updateLeaveStatus } from '../../services';
import type { LeaveRequest, LeaveStatus } from '../../types';

type Filter = 'pending' | 'all';

const statusBadge = (status: LeaveStatus) => {
  if (status === 'approved') return <Badge variant="success" dot>Approved</Badge>;
  if (status === 'rejected') return <Badge variant="danger" dot>Rejected</Badge>;
  return <Badge variant="warning" dot>Pending</Badge>;
};

/**
 * Leave request list with approve/reject. Visibility and permission are enforced by
 * RLS + the leave workflow trigger: wardens see/decide only their hostel's students,
 * admins see all; approved_by is always set by the database.
 */
export default function LeaveReview({ scopeLabel }: { scopeLabel: string }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const result = await getLeaveRequests();
    if (result.error) {
      setError(`Could not load leave requests: ${result.error}`);
      setRequests([]);
    } else {
      setRequests(result.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    getLeaveRequests().then((result) => {
      if (!active) return;
      if (result.error) setError(`Could not load leave requests: ${result.error}`);
      setRequests(result.data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const decide = async (request: LeaveRequest, status: 'approved' | 'rejected') => {
    if (savingId) return;
    setSavingId(request.id);
    setError(null);
    setSuccess(null);
    const remark = remarks[request.id]?.trim();
    const result = await updateLeaveStatus(request.id, status, remark || undefined);
    setSavingId(null);
    if (result.error || result.data?.status !== status) {
      setError(result.error || 'The database did not confirm the leave decision.');
      return;
    }
    setSuccess(`Leave request from ${request.student?.name || 'student'} ${status}.`);
    await load();
  };

  const visible = filter === 'pending' ? requests.filter((item) => item.status === 'pending') : requests;
  const pendingCount = requests.filter((item) => item.status === 'pending').length;

  return (
    <div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={filter === 'pending' ? 'primary' : 'outline'} onClick={() => setFilter('pending')}>Pending ({pendingCount})</Button>
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>All ({requests.length})</Button>
      </div>

      {loading ? <Card><p role="status" className="text-sm text-gray-500">Loading leave requests...</p></Card> : visible.length === 0 ? (
        <Card><p role="status" className="text-sm text-gray-500">{filter === 'pending' ? `No pending leave requests ${scopeLabel}.` : `No leave requests ${scopeLabel}.`}</p></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((request) => (
            <Card key={request.id} padding="sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{request.student?.name || 'Student'}</p>
                    {request.student?.student_id && <span className="text-xs text-gray-500">{request.student.student_id}</span>}
                    {statusBadge(request.status)}
                  </div>
                  <p className="text-sm text-gray-600">{request.reason} · {request.destination}</p>
                  <p className="text-sm text-gray-500">{request.start_date} to {request.end_date} · Emergency contact: {request.emergency_contact}</p>
                  {request.message && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{request.message}</p>}
                  {request.remark && <p className="mt-2 text-xs text-gray-500">Remark: {request.remark}</p>}
                </div>
                {request.status === 'pending' && (
                  <div className="flex shrink-0 flex-col gap-2 sm:w-64">
                    <Input placeholder="Remark (optional)" value={remarks[request.id] || ''} disabled={Boolean(savingId)}
                      onChange={(event) => setRemarks((current) => ({ ...current, [request.id]: event.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" leftIcon={<X className="h-4 w-4" />} disabled={Boolean(savingId)}
                        isLoading={savingId === request.id} onClick={() => void decide(request, 'rejected')}>Reject</Button>
                      <Button size="sm" className="flex-1" leftIcon={<Check className="h-4 w-4" />} disabled={Boolean(savingId)}
                        isLoading={savingId === request.id} onClick={() => void decide(request, 'approved')}>Approve</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
