import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Card, Input } from '../../components/ui';
import { useAuth } from '../../context';
import { getComplaints } from '../../services';
import type { Complaint, ComplaintStatus } from '../../types';

function statusLabel(status: ComplaintStatus): string {
  if (status === 'in_progress') return 'In Progress';
  return status[0].toUpperCase() + status.slice(1);
}

export default function AdminComplaints() {
  const { isConfigured } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadComplaints = async () => {
      setLoading(true);
      setError(null);
      if (!isConfigured) {
        setComplaints([]);
        setError('Supabase is not configured. Live complaints are unavailable.');
        setLoading(false);
        return;
      }

      const result = await getComplaints();
      if (!active) return;
      if (result.error) {
        setComplaints([]);
        setError(`Could not load complaints: ${result.error}`);
      } else {
        setComplaints(result.data || []);
      }
      setLoading(false);
    };

    void loadComplaints();
    return () => { active = false; };
  }, [isConfigured]);

  const query = search.trim().toLowerCase();
  const visibleComplaints = complaints.filter((complaint) => {
    const fields = [
      complaint.title,
      complaint.category,
      complaint.description,
      complaint.status,
      complaint.student?.name,
      complaint.student?.student_id,
      complaint.student?.email,
      complaint.student?.actual_hostel?.name,
      complaint.room?.hostel?.name,
      complaint.room?.room_number,
      complaint.student?.room?.room_number,
    ];
    return fields.some((value) => value?.toLowerCase().includes(query));
  });

  return (
    <div>
      <PageHeader title="All Complaints" description="View complaints across hostels visible to your admin account." />
      <div className="mb-6"><Input placeholder="Search complaints..." leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {loading ? <Card><p role="status" className="text-sm text-gray-500">Loading complaints...</p></Card> : error ? null : visibleComplaints.length === 0 ? (
        <Card><p role="status" className="text-sm text-gray-500">{query ? 'No complaints match your search.' : 'No complaints have been submitted.'}</p></Card>
      ) : (
        <div className="space-y-3">
          {visibleComplaints.map((complaint) => {
            const badgeVariant = complaint.status === 'resolved' ? 'success' : complaint.status === 'in_progress' ? 'info' : 'warning';
            const roomNumber = complaint.room?.room_number || complaint.student?.room?.room_number;
            const hostelName = complaint.student?.actual_hostel?.name || complaint.room?.hostel?.name;
            return (
              <Card key={complaint.id} padding="sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{complaint.title}</p>
                    <p className="text-sm text-gray-500">{complaint.category} · {complaint.student?.name || 'Student details unavailable'}{complaint.student?.student_id ? ` (${complaint.student.student_id})` : ''}{hostelName ? ` · ${hostelName}` : ''}{roomNumber ? ` · Room ${roomNumber}` : ''} · {new Date(complaint.created_at).toLocaleString()}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{complaint.description}</p>
                  </div>
                  <Badge variant={badgeVariant} dot>{statusLabel(complaint.status)}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
