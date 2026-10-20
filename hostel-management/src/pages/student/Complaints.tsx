import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [studentLookupError, setStudentLookupError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const submissionInProgress = useRef(false);

  const loadData = useCallback(async () => {
    if (!isConfigured || !user) return;

    const studentResult = await getStudentByUserId(user.id);
    if (studentResult.error || !studentResult.data) {
      setStudent(null);
      setComplaints([]);
      setHistoryError(null);
      setStudentLookupError(studentResult.error
        ? `Could not load the student record linked to this account: ${studentResult.error}`
        : 'No student record matching this sign-in is visible. The row may be missing, not linked to this Auth account, or hidden by the students SELECT policy. Ask the hostel administrator to verify the account link and read access.');
      setLoading(false);
      return;
    }
    setStudent(studentResult.data);
    setStudentLookupError(null);
    const complaintResult = await getComplaints({ studentId: studentResult.data.id });
    if (complaintResult.error) {
      setComplaints([]);
      setHistoryError(`Could not load your complaint history: ${complaintResult.error}`);
    } else {
      setComplaints(complaintResult.data || []);
    }
    setLoading(false);
  }, [isConfigured, user]);

  useEffect(() => {
    if (isConfigured && user) void loadData();
  }, [isConfigured, loadData, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionInProgress.current) return;
    if (!student) {
      setSubmitError('A student record must be linked to your sign-in before you can submit a complaint. Ask the hostel administrator to link your account.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setSubmitError('Enter a title and description before submitting.');
      return;
    }

    submissionInProgress.current = true;
    setSaving(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const result = await createComplaint({
        student_id: student.id,
        room_id: student.room_id || undefined,
        title: title.trim(),
        category,
        description: description.trim(),
      });
      if (result.error || !result.data?.id) {
        setSubmitError(result.error || 'The database did not confirm that the complaint was submitted. Your form is still available to retry.');
        return;
      }

      setTitle('');
      setDescription('');
      setCategory('other');
      setIsOpen(false);
      setSuccessMessage('Your complaint was submitted successfully.');
      setHistoryError(null);
      setLoading(true);
      await loadData();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit the complaint. Your form is still available to retry.');
    } finally {
      submissionInProgress.current = false;
      setSaving(false);
    }
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
        action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setSubmitError(null); setIsOpen(true); }} disabled={!isConfigured || !user || loading || !student}>New Complaint</Button>}
      />
      {!isConfigured && <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Connect Supabase to submit live complaints.</p>}
      {isConfigured && !user && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Your Supabase sign-in could not be identified. Sign out and sign in again.</p>}
      {studentLookupError && <Card className="mb-4"><p role="alert" className="text-sm font-medium text-rose-700">{studentLookupError}</p><p className="mt-2 text-sm text-gray-600">If you just signed up, confirm your email before signing in again. If the record still does not load, ask the hostel administrator to verify that your student record has the same email and student ID as your sign-up. The account will remain pending until one unambiguous record matches.</p></Card>}
      {historyError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{historyError}</p>}
      {successMessage && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p>}
      {!isConfigured || !user ? <Card><p role="status" className="text-sm text-gray-500">Live complaint history is unavailable until you are signed in to Supabase.</p></Card> : loading ? <p role="status" className="text-sm text-gray-500">Loading complaints...</p> : studentLookupError || historyError ? null : complaints.length === 0 ? <Card><p role="status" className="text-sm text-gray-500">No complaints submitted yet.</p></Card> : (
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
      <Modal isOpen={isOpen} onClose={() => { if (!saving) setIsOpen(false); }} title="New Complaint" footer={<><Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="complaint-form" isLoading={saving} disabled={saving || !student}>Submit</Button></>}>
        <form id="complaint-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required disabled={saving} />
          <Select label="Category" options={categories} value={category} onChange={(event) => setCategory(event.target.value as ComplaintCategory)} disabled={saving} />
          <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} required disabled={saving} />
          {!student && <p className="text-sm text-amber-700">Your account does not have a linked student record. Ask the hostel administrator to link it before submitting.</p>}
          {submitError && <p role="alert" className="text-sm text-rose-700">{submitError}</p>}
        </form>
      </Modal>
    </div>
  );
}
