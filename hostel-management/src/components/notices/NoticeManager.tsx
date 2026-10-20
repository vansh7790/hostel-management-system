import { useCallback, useEffect, useState } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../layout';
import { Badge, Button, Card, Input, Modal, Select, Textarea } from '../ui';
import { useAuth } from '../../context';
import { createNotice, deleteNotice, getHostels, getNotices } from '../../services';
import type { Hostel, Notice, NoticePriority } from '../../types';

const GLOBAL = 'global';

/**
 * Publish/list/delete notices. Admins may post global or hostel notices; wardens only
 * for hostels assigned to them. The database enforces this and sets posted_by itself.
 */
export default function NoticeManager({ role }: { role: 'admin' | 'warden' }) {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', description: '', priority: 'medium' as NoticePriority, target: '' });

  const load = useCallback(async () => {
    const [noticeResult, hostelResult] = await Promise.all([
      getNotices(),
      getHostels(role === 'warden' && user ? { wardenId: user.id } : undefined),
    ]);
    const errors = [noticeResult.error, hostelResult.error].filter(Boolean);
    setError(errors.length ? `Could not load notices: ${errors.join(' ')}` : null);
    setNotices(noticeResult.data || []);
    setHostels(hostelResult.data || []);
    setLoading(false);
  }, [role, user]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getNotices(),
      getHostels(role === 'warden' && user ? { wardenId: user.id } : undefined),
    ]).then(([noticeResult, hostelResult]) => {
      if (!active) return;
      const errors = [noticeResult.error, hostelResult.error].filter(Boolean);
      setError(errors.length ? `Could not load notices: ${errors.join(' ')}` : null);
      setNotices(noticeResult.data || []);
      setHostels(hostelResult.data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [role, user]);

  const hostelName = (id?: string) => (id ? hostels.find((hostel) => hostel.id === id)?.name || 'Hostel notice' : 'All hostels');
  const targetOptions = [
    ...(role === 'admin' ? [{ value: GLOBAL, label: 'All hostels (global notice)' }] : []),
    ...hostels.map((hostel) => ({ value: hostel.id, label: hostel.name })),
  ];

  const openCreate = () => {
    setDraft({ title: '', description: '', priority: 'medium', target: role === 'admin' ? GLOBAL : hostels[0]?.id || '' });
    setFormError(null);
    setSuccess(null);
    setIsOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!draft.title.trim() || !draft.description.trim()) {
      setFormError('Title and message are required.');
      return;
    }
    if (!draft.target) {
      setFormError('Choose who should see this notice.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await createNotice({
      title: draft.title.trim(),
      description: draft.description.trim(),
      priority: draft.priority,
      posted_by: user.id,
      hostel_id: draft.target === GLOBAL ? undefined : draft.target,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setFormError(result.error || 'The database did not confirm the notice.');
      return;
    }
    setIsOpen(false);
    setSuccess(`Notice “${result.data.title}” published.`);
    await load();
  };

  const handleDelete = async (notice: Notice) => {
    setDeletingId(notice.id);
    setError(null);
    setSuccess(null);
    const result = await deleteNotice(notice.id);
    setDeletingId(null);
    if (result.error) {
      setError(`Could not delete notice: ${result.error}`);
      return;
    }
    setSuccess('Notice deleted.');
    await load();
  };

  // Mirrors notices_delete_scoped: admins delete any notice; wardens their own hostel notices.
  const canDelete = (notice: Notice) => role === 'admin' || (notice.posted_by === user?.id && Boolean(notice.hostel_id));
  const noHostels = role === 'warden' && !loading && hostels.length === 0;

  return (
    <div>
      <PageHeader
        title="Notices"
        description={role === 'admin' ? 'Publish global or hostel-specific notices.' : 'Publish and manage notices for your assigned hostel.'}
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={loading || noHostels}>New Notice</Button>}
      />
      {noHostels && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No hostel is assigned to your account, so you cannot publish notices yet.</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      {loading ? <Card><p role="status" className="text-sm text-gray-500">Loading notices...</p></Card> : notices.length === 0 ? (
        <Card><p role="status" className="text-sm text-gray-500">No notices have been published yet.</p></Card>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <Card key={notice.id}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0"><Bell className="h-5 w-5 text-primary-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">{notice.title}</h3>
                    <Badge variant={notice.priority === 'high' ? 'danger' : notice.priority === 'medium' ? 'warning' : 'default'} dot>{notice.priority}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{notice.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{hostelName(notice.hostel_id)} · Posted by {notice.poster_name || 'Hostel Administration'} · {new Date(notice.created_at).toLocaleDateString()}</p>
                </div>
                {canDelete(notice) && (
                  <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-4 w-4" />} isLoading={deletingId === notice.id}
                    disabled={Boolean(deletingId)} onClick={() => void handleDelete(notice)}>Delete</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={() => { if (!saving) setIsOpen(false); }} title="New Notice"
        footer={<><Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="notice-form" isLoading={saving}>Publish</Button></>}>
        <form id="notice-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required disabled={saving} />
          <Textarea label="Message" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} required disabled={saving} />
          <Select label="Priority" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as NoticePriority })} disabled={saving}
            options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
          <Select label="Audience" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} disabled={saving}
            options={targetOptions} placeholder="Select audience" />
          {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
