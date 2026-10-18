import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Card } from '../../components/ui';
import { useAuth } from '../../context';
import { getNotices, getStudentByUserId } from '../../services';
import type { Notice } from '../../types';

export default function StudentNotices() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const studentResult = await getStudentByUserId(user.id);
      const result = await getNotices(studentResult.data?.hostel_id);
      if (studentResult.error && !studentResult.data) setErrorMessage(studentResult.error);
      else if (result.error) setErrorMessage(result.error);
      setNotices(result.data || []);
      setLoading(false);
    };
    void load();
  }, [user]);

  return (
    <div>
      <PageHeader title="Notices" description="Important hostel announcements and updates." />
      {errorMessage && <p className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading notices...</p> : notices.length === 0 ? <Card><p className="text-sm text-gray-500">No notices are available.</p></Card> : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <Card key={notice.id} hover>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0"><Bell className="h-5 w-5 text-primary-600" /></div>
                <div className="flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-gray-900">{notice.title}</h3><Badge variant={notice.priority === 'high' ? 'danger' : notice.priority === 'medium' ? 'warning' : 'default'} dot>{notice.priority}</Badge></div><p className="text-sm text-gray-600 mt-1">{notice.description}</p><p className="text-xs text-gray-400 mt-2">Posted by {notice.poster_name || 'Hostel Administration'} · {new Date(notice.created_at).toLocaleDateString()}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
