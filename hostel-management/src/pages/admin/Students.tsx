import { useEffect, useState } from 'react';
import { Plus, Search, User, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Card, Input, Button, Modal, Select, Badge } from '../../components/ui';
import { useAuth } from '../../context';
import { createStudent, getHostels, getStudents, updateStudent } from '../../services';
import type { Hostel, Student } from '../../types';

type StudentDraft = {
  student_id: string; name: string; email: string; phone: string;
  department: string; year: string; guardian_name: string; guardian_phone: string; address: string; hostel_id: string;
};

const emptyDraft: StudentDraft = {
  student_id: '', name: '', email: '', phone: '', department: '', year: '',
  guardian_name: '', guardian_phone: '', address: '', hostel_id: '',
};

const toDraft = (student: Student): StudentDraft => ({
  student_id: student.student_id, name: student.name, email: student.email,
  phone: student.phone || '', department: student.department || '', year: student.year?.toString() || '',
  guardian_name: student.guardian_name || '', guardian_phone: student.guardian_phone || '', address: student.address || '',
  hostel_id: student.intended_hostel_id || (!student.room_id ? student.hostel_id || '' : ''),
});

const textField = (value: string) => value.trim() || undefined;

export default function AdminStudents() {
  const { isConfigured } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [hostelsLoading, setHostelsLoading] = useState(true);
  const [hostelsError, setHostelsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkWarning, setLinkWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [draft, setDraft] = useState<StudentDraft>(emptyDraft);

  const showStudentsResult = (result: Awaited<ReturnType<typeof getStudents>>) => {
    if (result.error) {
      setErrorMessage(`Could not load students: ${result.error}`);
      setStudents([]);
    } else {
      setStudents(result.data || []);
      setErrorMessage(result.source === 'demo' ? 'Demo data is being shown. Connect Supabase to view persistent student records.' : null);
    }
    setLoading(false);
  };

  const loadStudents = async () => {
    setLoading(true);
    showStudentsResult(await getStudents({ search }));
  };

  useEffect(() => {
    let active = true;
    getStudents({ search }).then((result) => { if (active) showStudentsResult(result); });
    return () => { active = false; };
  }, [search]);

  useEffect(() => {
    let active = true;
    getHostels().then((result) => {
      if (!active) return;
      if (result.error) {
        setHostelsError(`Could not load hostels: ${result.error}`);
        setHostels([]);
      } else {
        setHostels(result.data || []);
        setHostelsError(null);
      }
      setHostelsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const openCreate = () => {
    setEditingStudent(null);
    setDraft(emptyDraft);
    setErrorMessage(null);
    setLinkWarning(null);
    setSuccessMessage(null);
    setIsOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setDraft(toDraft(student));
    setErrorMessage(null);
    setLinkWarning(null);
    setSuccessMessage(null);
    setIsOpen(true);
  };

  const updateDraft = (field: keyof StudentDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const year = draft.year.trim() ? Number(draft.year) : undefined;
    if (!draft.student_id.trim() || !draft.name.trim() || !draft.email.trim()) {
      setErrorMessage('Student ID, full name, and email are required.');
      return;
    }
    if (year !== undefined && (!Number.isInteger(year) || year < 1 || year > 5)) {
      setErrorMessage('Year of study must be a whole number from 1 to 5.');
      return;
    }

    if (!editingStudent?.room_id) {
      const intendedHostel = hostels.find((hostel) => hostel.id === draft.hostel_id);
      if (!intendedHostel) {
        setErrorMessage('Choose an intended hostel for this pending allocation.');
        return;
      }
    }

    setSaving(true);
    const payload = {
      student_id: draft.student_id.trim(), name: draft.name.trim(), email: draft.email.trim().toLowerCase(),
      phone: textField(draft.phone), department: textField(draft.department), year,
      guardian_name: textField(draft.guardian_name), guardian_phone: textField(draft.guardian_phone),
      address: textField(draft.address),
      ...(!editingStudent?.room_id ? { intended_hostel_id: draft.hostel_id } : {}),
    };
    const result = editingStudent
      ? await updateStudent(editingStudent.id, payload)
      : await createStudent(payload);
    setSaving(false);

    if (result.error || !result.data) {
      setErrorMessage(`Could not ${editingStudent ? 'update' : 'create'} student: ${result.error || 'No student record was returned.'}`);
      return;
    }

    setIsOpen(false);
    if (result.source === 'demo') {
      setSuccessMessage('Demo-only change made in memory. It is not saved to Supabase and will be lost on refresh.');
    } else {
      setSuccessMessage(`Student ${editingStudent ? 'updated' : 'created'} successfully.`);
    }
    await loadStudents();
    if (result.warning) setLinkWarning(result.warning);
  };

  const field = (label: string, key: keyof StudentDraft, options: { type?: string; required?: boolean; min?: string; max?: string } = {}) => (
    <Input
      label={label}
      type={options.type || 'text'}
      value={draft[key]}
      onChange={(event) => updateDraft(key, event.target.value)}
      required={options.required}
      min={options.min}
      max={options.max}
      disabled={saving}
    />
  );

  return (
    <div>
      <PageHeader title="Students" description="Manage student records and their sign-in links." action={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!isConfigured || hostelsLoading || Boolean(hostelsError) || hostels.length === 0}>Add Student</Button>
      } />
      {!isConfigured && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Supabase is not configured. The student data below is demo-only; connect Supabase to create or edit persistent records.</p>}
      {errorMessage && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>}
      {hostelsError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{hostelsError}</p>}
      {!hostelsLoading && !hostelsError && hostels.length === 0 && isConfigured && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No hostels are available. Add a hostel before creating a student record.</p>}
      {successMessage && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p>}
      {linkWarning && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{linkWarning}</p>}
      {isConfigured && <p role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Student records are separate from login accounts. Students sign up with the record's email and student ID; the account links after email confirmation when one unambiguous matching record exists. Unmatched or ambiguous registrations need administrator review.</p>}
      <div className="mb-6">
        <Input placeholder="Search by name, student ID, or email..." leftIcon={<Search className="h-4 w-4" />}
          value={search} onChange={(event) => { setErrorMessage(null); setSearch(event.target.value); setLoading(true); }} />
      </div>
      {loading ? <Card><p className="text-sm text-gray-500">Loading students...</p></Card> : errorMessage?.startsWith('Could not load students:') ? (
        <Card><p className="text-sm text-rose-700">Student records could not be loaded. Resolve the error above and retry by changing the search or refreshing the page.</p></Card>
      ) : students.length === 0 ? (
        <Card><p className="text-sm text-gray-500">{search.trim() ? 'No students match your search.' : 'No student records found.'}</p></Card>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <Card key={student.id} padding="sm" hover>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center"><User className="h-5 w-5 text-gray-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5"><Badge variant={student.room_id ? 'success' : 'warning'} dot>{student.room_id ? 'Room allocated' : 'Pending allocation'}</Badge><Badge variant={student.user_id ? 'success' : 'warning'} dot>{student.user_id ? 'Sign-in linked' : 'No sign-in linked'}</Badge></div>
                  <p className="text-sm text-gray-500">{student.student_id} · {student.department || 'Department not set'}{student.year ? ` · Year ${student.year}` : ''}</p>
                  <p className="text-sm text-gray-500 truncate">{student.email}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-gray-900">{student.intended_hostel?.name || student.actual_hostel?.name || 'No hostel assigned'}</p>
                  <p className="text-sm text-gray-500">{student.room?.room_number ? `Room ${student.room.room_number}` : 'No room assigned'}</p>
                </div>
                <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(student)} disabled={!isConfigured}>Edit</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={() => !saving && setIsOpen(false)} title={editingStudent ? 'Edit Student' : 'Add Student'} size="lg"
        footer={<><Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="student-form" isLoading={saving}>{editingStudent ? 'Save Changes' : 'Create Student'}</Button></>}>
        <form id="student-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">This form creates or updates the student record; it does not create login credentials. After this record exists, the student can sign up with the same email and student ID and confirm the email to link the account. Room allocation remains a separate action.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {field('Student ID', 'student_id', { required: true })}
            {field('Full name', 'name', { required: true })}
            {field('Email', 'email', { type: 'email', required: true })}
            {field('Phone', 'phone', { type: 'tel' })}
            {field('Department', 'department')}
            {field('Year of study', 'year', { type: 'number', min: '1', max: '5' })}
            {field('Guardian name', 'guardian_name')}
            {field('Guardian phone', 'guardian_phone', { type: 'tel' })}
          </div>
          {!editingStudent?.room_id && (
            <div>
              <Select
                label="Intended hostel"
                value={draft.hostel_id}
                onChange={(event) => updateDraft('hostel_id', event.target.value)}
                options={hostels.map((hostel) => ({
                  value: hostel.id,
                  label: `${hostel.name}${hostel.warden_id ? '' : ' — No warden assigned'}`,
                }))}
                placeholder={hostelsLoading ? 'Loading hostels…' : 'Select the hostel for allocation'}
                required
                disabled={saving || hostelsLoading || Boolean(hostelsError)}
              />
              {draft.hostel_id && !hostels.find((hostel) => hostel.id === draft.hostel_id)?.warden_id && (
                <p className="mt-1.5 text-xs text-amber-700">This pending student will not appear in a warden queue until a warden is assigned to this hostel.</p>
              )}
            </div>
          )}
          {editingStudent?.room_id && <p className="text-sm text-gray-600">Hostel and room stay unchanged while editing an allocated student. Room changes belong to the separate allocation workflow.</p>}
          {field('Address', 'address')}
          {!editingStudent && <p className="text-xs text-gray-500">Creating this record does not create a login account or assign a room.</p>}
          {errorMessage && <p role="alert" className="text-sm text-rose-700">{errorMessage}</p>}
        </form>
      </Modal>
    </div>
  );
}
