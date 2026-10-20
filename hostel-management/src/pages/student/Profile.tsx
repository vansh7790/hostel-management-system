import { useState } from 'react';
import { PageHeader } from '../../components/layout';
import { Card, Badge, Button, Input, Modal } from '../../components/ui';
import UnlinkedStudentNotice from '../../components/student/UnlinkedStudentNotice';
import { Phone, Mail, GraduationCap, MapPin } from 'lucide-react';
import { useCurrentStudent } from '../../hooks/useCurrentStudent';
import { updateStudent } from '../../services';

type ContactDraft = { phone: string; guardian_name: string; guardian_phone: string; address: string };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
const valueOrDash = (value?: string | number | null) => (value === undefined || value === null || value === '' ? '—' : String(value));

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <span className="text-gray-400 block">{label}</span>
      <span className="font-semibold text-gray-800 text-sm">{valueOrDash(value)}</span>
    </div>
  );
}

export default function StudentProfile() {
  const { student, loading, error, reload } = useCurrentStudent();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>({ phone: '', guardian_name: '', guardian_phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openEdit = () => {
    if (!student) return;
    setDraft({
      phone: student.phone || '', guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '', address: student.address || '',
    });
    setSaveError(null);
    setSaved(false);
    setIsEditing(true);
  };

  // The database allows students to change only these contact fields on their own record.
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!student) return;
    setSaving(true);
    setSaveError(null);
    const result = await updateStudent(student.id, {
      phone: draft.phone.trim() || undefined,
      guardian_name: draft.guardian_name.trim() || undefined,
      guardian_phone: draft.guardian_phone.trim() || undefined,
      address: draft.address.trim() || undefined,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setSaveError(result.error || 'The update was not confirmed by the database.');
      return;
    }
    setIsEditing(false);
    setSaved(true);
    reload();
  };

  const hostelName = student?.actual_hostel?.name;
  const roomNumber = student?.room?.room_number;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Profile"
        description="Your official residential record and emergency contact details."
        action={student ? <Button size="sm" variant="outline" onClick={openEdit}>Edit Contact Details</Button> : undefined}
      />

      {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">Contact details saved.</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading your profile...</p>
      ) : !student ? (
        !error && <UnlinkedStudentNotice />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="text-center p-6">
            <div className="w-20 h-20 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold border-2 border-primary-200">
              {initials(student.name)}
            </div>
            <h3 className="text-base font-bold text-gray-900">{student.name}</h3>
            <p className="text-xs text-gray-500">Student ID: {student.student_id}</p>
            <div className="mt-2 flex justify-center gap-1.5">
              <Badge variant={student.room_id ? 'success' : 'warning'} dot>{student.room_id ? 'Room allocated' : 'Pending allocation'}</Badge>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 text-left text-xs space-y-2.5 text-gray-600">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-gray-400" />
                <span>{valueOrDash(student.department)}{student.year ? ` · Year ${student.year}` : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="truncate">{student.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{valueOrDash(student.phone)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{hostelName && roomNumber ? `${hostelName} · Room ${roomNumber}` : 'No room allocated yet'}</span>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Academic & Hostel Information
              </h4>
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <Field label="Student ID" value={student.student_id} />
                <Field label="Department" value={student.department} />
                <Field label="Year of Study" value={student.year} />
                <Field label="Hostel" value={hostelName || (student.room_id ? undefined : 'Pending allocation')} />
              </div>
            </Card>

            <Card>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Guardian & Emergency Contact
              </h4>
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <Field label="Guardian Name" value={student.guardian_name} />
                <Field label="Guardian Phone" value={student.guardian_phone} />
                <Field label="Permanent Address" value={student.address} />
              </div>
            </Card>
            <p className="text-xs text-gray-500">Name, email, student ID, and academic details are maintained by the hostel administrator.</p>
          </div>
        </div>
      )}

      <Modal
        isOpen={isEditing}
        onClose={() => { if (!saving) setIsEditing(false); }}
        title="Edit Contact Details"
        footer={<>
          <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="contact-form" isLoading={saving}>Save</Button>
        </>}
      >
        <form id="contact-form" onSubmit={handleSave} className="space-y-4">
          <Input label="Phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} disabled={saving} />
          <Input label="Guardian name" value={draft.guardian_name} onChange={(e) => setDraft({ ...draft, guardian_name: e.target.value })} disabled={saving} />
          <Input label="Guardian phone" type="tel" value={draft.guardian_phone} onChange={(e) => setDraft({ ...draft, guardian_phone: e.target.value })} disabled={saving} />
          <Input label="Permanent address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} disabled={saving} />
          {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
        </form>
      </Modal>
    </div>
  );
}
