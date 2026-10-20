import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/layout';
import { Badge, Button, Card } from '../../components/ui';
import { useAuth } from '../../context';
import { getComplaints, updateComplaintStatus } from '../../services';
import type { Complaint, ComplaintStatus } from '../../types';

function statusLabel(status: ComplaintStatus): string {
  if (status === 'in_progress') return 'In Progress';
  return status[0].toUpperCase() + status.slice(1);
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function WardenComplaints() {
  const { isConfigured } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadComplaints = useCallback(async () => {
    if (!isConfigured) return;

    const result = await getComplaints();
    if (result.error) {
      setComplaints([]);
      setError(`Could not load complaints: ${result.error}`);
    } else {
      setComplaints(result.data || []);
      setError(null);
    }
    setLoading(false);
  }, [isConfigured]);

  useEffect(() => {
    if (isConfigured) void loadComplaints();
  }, [isConfigured, loadComplaints]);

  const changeStatus = async (complaint: Complaint, status: ComplaintStatus) => {
    if (savingId) return;
    setSavingId(complaint.id);
    setError(null);
    setSuccess(null);

    const result = await updateComplaintStatus(complaint.id, status);
    setSavingId(null);
    if (result.error || !result.data?.id) {
      setError(result.error || 'The database did not confirm the complaint status update.');
      return;
    }

    setComplaints((current) => current.map((item) => item.id === complaint.id ? result.data! : item));
    setSuccess(`Complaint “${result.data.title}” marked ${statusLabel(result.data.status).toLowerCase()}.`);
    setLoading(true);
    await loadComplaints();
  };

  return (
    <div>
      <PageHeader title="Complaints" description="Review and update complaints for your assigned hostel." />
      {!isConfigured && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Supabase is not configured. Live complaints are unavailable.</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      {!isConfigured ? null : loading ? <Card><p role="status" className="text-sm text-gray-500">Loading complaints...</p></Card> : error ? null : complaints.length === 0 ? (
        <Card><p role="status" className="text-sm text-gray-500">No complaints are available for your assigned hostel.</p></Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((complaint) => {
            const badgeVariant = complaint.status === 'resolved' ? 'success' : complaint.status === 'in_progress' ? 'info' : 'warning';
            const roomNumber = complaint.room?.room_number || complaint.student?.room?.room_number;
            return (
              <Card key={complaint.id} padding="sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{complaint.title}</h2>
                      <Badge variant={badgeVariant} dot>{statusLabel(complaint.status)}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{formatCategory(complaint.category)} · {new Date(complaint.created_at).toLocaleString()}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{complaint.description}</p>
                    <p className="mt-3 text-sm text-gray-500">
                      Student: {complaint.student?.name || 'Student details unavailable'}
                      {complaint.student?.student_id ? ` (${complaint.student.student_id})` : ''}
                      {' · '}Room: {roomNumber || 'No room recorded'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {complaint.status === 'pending' && <Button size="sm" variant="outline" isLoading={savingId === complaint.id} disabled={Boolean(savingId)} onClick={() => void changeStatus(complaint, 'in_progress')}>Start</Button>}
                    {complaint.status === 'in_progress' && <Button size="sm" isLoading={savingId === complaint.id} disabled={Boolean(savingId)} onClick={() => void changeStatus(complaint, 'resolved')}>Resolve</Button>}
                    {complaint.status === 'resolved' && <Badge variant="success">Resolved</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
