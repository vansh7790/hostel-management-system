import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Button, Card, Input, Modal, Select, Textarea } from '../../components/ui';
import { useAuth } from '../../context';
import { createComplaint, getComplaints, getStudentByUserId } from '../../services';
import type { Complaint, ComplaintCategory, Student } from '../../types';

const categories: { value: ComplaintCategory; label: string }[] = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'internet', label: 'Internet' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'other', label: 'Other' },
];

export default function StudentComplaints() {
  const { user, isConfigured } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('other');
  const [description, setDescription] = useState('');
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
    const complaintResult = await getComplaints({ studentId: studentResult.data.id });
    if (complaintResult.error) setErrorMessage(complaintResult.error);
    setComplaints(complaintResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!student || !title.trim() || !description.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    const result = await createComplaint({
      student_id: student.id,
      room_id: student.room_id || undefined,
      title: title.trim(),
      category,
      description: description.trim(),
    });
    setSaving(false);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    setTitle('');
    setDescription('');
    setCategory('other');
    setIsOpen(false);
    await loadData();
  };

  const statusBadge = (status: Complaint['status']) => (
    <Badge variant={status === 'resolved' ? 'success' : status === 'in_progress' ? 'info' : 'warning'} dot>
      {status === 'in_progress' ? 'In Progress' : status[0].toUpperCase() + status.slice(1)}
    </Badge>
  );

  return (
    <div>
      <PageHeader
        title="My Complaints"
        description="Submit and track your maintenance complaints."
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsOpen(true)} disabled={!isConfigured}>New Complaint</Button>}
      />
      {!isConfigured && <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Connect Supabase to submit live complaints.</p>}
      {errorMessage && <p className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading complaints...</p> : complaints.length === 0 ? <Card><p className="text-sm text-gray-500">No complaints submitted yet.</p></Card> : (
        <div className="space-y-3">
          {complaints.map((complaint) => (
            <Card key={complaint.id} padding="sm" hover>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{complaint.title}</p>
                  <p className="text-sm text-gray-500">{complaint.category} · {new Date(complaint.created_at).toLocaleDateString()}</p>
                </div>
                {statusBadge(complaint.status)}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="New Complaint" footer={<><Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button><Button type="submit" form="complaint-form" isLoading={saving}>Submit</Button></>}>
        <form id="complaint-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <Select label="Category" options={categories} value={category} onChange={(event) => setCategory(event.target.value as ComplaintCategory)} />
          <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} required />
        </form>
      </Modal>
    </div>
  );
}
