import { useEffect, useState } from 'react';
import { Search, User } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Button, Card, Input } from '../../components/ui';
import { useAuth } from '../../context';
import { getHostels, getStudents } from '../../services';
import type { Student } from '../../types';

export default function WardenStudents() {
  const { isConfigured, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showStudentsResult = (result: Awaited<ReturnType<typeof getStudents>>) => {
    if (result.error) {
      setErrorMessage(`Could not load students: ${result.error}`);
      setStudents([]);
    } else {
      setStudents(result.data || []);
      setErrorMessage(result.source === 'demo' ? 'Demo data is being shown. Connect Supabase to view records permitted for your account.' : null);
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) {
        if (active) showStudentsResult({ data: null, error: 'Your signed-in account is unavailable.', source: 'supabase' });
        return;
      }
      const hostelResult = await getHostels({ wardenId: user.id });
      if (hostelResult.error) {
        if (active) showStudentsResult({ data: null, error: `Could not load your assigned hostels: ${hostelResult.error}`, source: 'supabase' });
        return;
      }
      const assignedHostelIds = (hostelResult.data || []).map((hostel) => hostel.id);
      if (assignedHostelIds.length === 0) {
        if (active) showStudentsResult({ data: [], error: null, source: isConfigured ? 'supabase' : 'demo' });
        return;
      }
      const [allocatedResult, pendingResult] = await Promise.all([
        getStudents({ hostelIds: assignedHostelIds, search }),
        getStudents({ intendedHostelIds: assignedHostelIds, search }),
      ]);
      if (!active) return;
      const errors = [allocatedResult.error, pendingResult.error].filter(Boolean);
      if (errors.length) {
        showStudentsResult({ data: null, error: errors.join(' '), source: 'supabase' });
        return;
      }
      const combined = new Map<string, Student>();
      for (const student of [...(allocatedResult.data || []), ...(pendingResult.data || []).filter((item) => !item.room_id)]) {
        combined.set(student.id, student);
      }
      showStudentsResult({ data: [...combined.values()], error: null, source: allocatedResult.source });
    };
    void load();
    return () => { active = false; };
  }, [search, user, isConfigured]);

  const visibleStudents = pendingOnly ? students.filter((student) => !student.room_id) : students;

  return (
    <div>
      <PageHeader title="Students" description="View students visible to your account." />
      {!isConfigured && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Supabase is not configured. The student data below is demo-only and is not filtered by database permissions.</p>}
      {errorMessage && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}
      <div className="mb-6">
        <Input placeholder="Search by name, student ID, or email..." leftIcon={<Search className="h-4 w-4" />}
          value={search} onChange={(event) => { setErrorMessage(null); setSearch(event.target.value); setLoading(true); }} />
      </div>
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={pendingOnly ? 'outline' : 'primary'} onClick={() => setPendingOnly(false)}>All students ({students.length})</Button>
        <Button size="sm" variant={pendingOnly ? 'primary' : 'outline'} onClick={() => setPendingOnly(true)}>Pending allocation ({students.filter((student) => !student.room_id).length})</Button>
      </div>
      {loading ? <Card><p className="text-sm text-gray-500">Loading students in your assigned hostels...</p></Card> : errorMessage ? (
        <Card><p className="text-sm text-rose-700">Student records could not be loaded. Resolve the error above and retry by changing the search or refreshing the page.</p></Card>
      ) : visibleStudents.length === 0 ? (
        <Card><p className="text-sm text-gray-500">{pendingOnly ? 'No pending allocations are visible in your assigned hostels.' : search.trim() ? 'No visible students match your search.' : 'No student records are visible in your assigned hostels.'}</p></Card>
      ) : (
        <div className="space-y-3">
          {visibleStudents.map((student) => (
            <Card key={student.id} padding="sm" hover>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center"><User className="h-5 w-5 text-gray-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <div className="mt-1"><Badge variant={student.room_id ? 'success' : 'warning'} dot>{student.room_id ? 'Room allocated' : 'Pending allocation'}</Badge></div>
                  <p className="text-sm text-gray-500">{student.student_id} · {student.department || 'Department not set'}{student.year ? ` · Year ${student.year}` : ''}</p>
                  <p className="text-sm text-gray-500 truncate">{student.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{student.intended_hostel?.name || student.hostel?.name || 'No hostel assigned'}</p>
                  <p className="text-sm text-gray-500">{student.room?.room_number ? `Room ${student.room.room_number}` : 'No room assigned'}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
