import { useCallback, useEffect, useState } from 'react';
import { Plus, Building2, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Card, Badge, Button, ConfirmDialog, Input, Modal, Select } from '../../components/ui';
import { useAuth } from '../../context';
import { createHostel, deleteHostel, getHostelDirectory, getHostelWardens, updateHostel } from '../../services';
import type { HostelDirectoryEntry, HostelWarden } from '../../services/hostelsService';
import type { Hostel } from '../../types';

type HostelDraft = {
  name: string;
  type: Hostel['type'];
  warden_id: string;
  address: string;
};

const emptyDraft: HostelDraft = { name: '', type: 'boys', warden_id: '', address: '' };

export default function AdminHostels() {
  const { isConfigured } = useAuth();
  const [hostels, setHostels] = useState<HostelDirectoryEntry[]>([]);
  const [wardens, setWardens] = useState<HostelWarden[]>([]);
  const [loading, setLoading] = useState(true);
  const [wardensLoading, setWardensLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [wardensError, setWardensError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<HostelDraft>(emptyDraft);
  const [editingHostel, setEditingHostel] = useState<HostelDirectoryEntry | null>(null);
  const [deletingHostel, setDeletingHostel] = useState<HostelDirectoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const applyDirectoryResult = useCallback((result: Awaited<ReturnType<typeof getHostelDirectory>>) => {
    if (result.error) {
      setHostels([]);
      setDirectoryError(`Could not load hostel directory: ${result.error}`);
      setMetricsError(null);
    } else {
      setHostels(result.data || []);
      setDirectoryError(null);
      setMetricsError(result.metricsError ? `Hostels loaded, but occupancy statistics could not be loaded: ${result.metricsError}` : null);
    }
    setLoading(false);
  }, []);

  const applyWardensResult = useCallback((result: Awaited<ReturnType<typeof getHostelWardens>>) => {
    if (result.error) {
      setWardens([]);
      setWardensError(`Could not load warden profiles: ${result.error}`);
    } else {
      setWardens(result.data || []);
      setWardensError(null);
    }
    setWardensLoading(false);
  }, []);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    applyDirectoryResult(await getHostelDirectory());
  }, [applyDirectoryResult]);

  const loadWardens = useCallback(async () => {
    setWardensLoading(true);
    applyWardensResult(await getHostelWardens());
  }, [applyWardensResult]);

  useEffect(() => {
    let active = true;
    getHostelDirectory().then((result) => { if (active) applyDirectoryResult(result); });
    return () => { active = false; };
  }, [applyDirectoryResult]);

  useEffect(() => {
    let active = true;
    getHostelWardens().then((result) => { if (active) applyWardensResult(result); });
    return () => { active = false; };
  }, [applyWardensResult]);

  const openEdit = (hostel: HostelDirectoryEntry) => {
    setEditingHostel(hostel);
    setDraft({ name: hostel.name, type: hostel.type, warden_id: hostel.warden_id || '', address: hostel.address || '' });
    setFormError(null);
    setSuccessMessage(null);
    setActionError(null);
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingHostel) return;
    setDeleting(true);
    const result = await deleteHostel(deletingHostel.id);
    setDeleting(false);
    if (result.error) {
      setActionError(`Could not delete ${deletingHostel.name}: ${result.error}`);
      setDeletingHostel(null);
      return;
    }
    setSuccessMessage(`${deletingHostel.name} was deleted.`);
    setDeletingHostel(null);
    await loadDirectory();
  };

  const openCreate = () => {
    setEditingHostel(null);
    setActionError(null);
    setDraft(emptyDraft);
    setFormError(null);
    setSuccessMessage(null);
    setIsOpen(true);
  };

  const setField = <K extends keyof HostelDraft>(key: K, value: HostelDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const name = draft.name.trim();
    if (!name) {
      setFormError('Hostel name is required.');
      return;
    }

    setSaving(true);
    const payload = {
      name,
      type: draft.type,
      warden_id: draft.warden_id || null,
      address: draft.address.trim() || undefined,
    };
    const result = editingHostel ? await updateHostel(editingHostel.id, payload) : await createHostel(payload);
    setSaving(false);

    if (result.error || !result.data) {
      setFormError(`Could not ${editingHostel ? 'update' : 'create'} hostel: ${result.error || 'No hostel record was returned.'}`);
      return;
    }

    setIsOpen(false);
    setDraft(emptyDraft);
    setSuccessMessage(editingHostel ? 'Hostel updated successfully.' : 'Hostel created successfully.');
    setEditingHostel(null);
    await loadDirectory();
  };

  const wardenNames = new Map(wardens.map((warden) => [warden.id, warden.full_name]));

  return (
    <div>
      <PageHeader
        title="Hostels Directory"
        description="Campus residential buildings, room capacity, live allocations, and assigned wardens."
        action={<Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!isConfigured}>Add Hostel</Button>}
      />
      {!isConfigured && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Supabase is not configured. Hostel records and changes require a database connection; no sample hostels are shown.</p>}
      {actionError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>}
      {successMessage && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p>}
      {directoryError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert"><span>{directoryError}</span><Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadDirectory()}>Retry</Button></div>}
      {metricsError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert"><span>{metricsError}</span><Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadDirectory()}>Retry statistics</Button></div>}
      {wardensError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert"><span>{wardensError} You can still create a hostel without assigning a warden.</span><Button variant="outline" size="sm" onClick={() => void loadWardens()}>Retry</Button></div>}

      {loading ? <Card><p className="text-sm text-gray-500">Loading hostel directory and allocation counts…</p></Card> : directoryError ? null : hostels.length === 0 ? (
        <Card><p className="text-sm text-gray-600">The authenticated database query returned no visible hostel rows. Existing rows may be hidden by the deployed SELECT RLS policy.</p></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {hostels.map((hostel) => {
            const occupancy = hostel.capacity && hostel.resident_count !== null
              ? Math.round((hostel.resident_count / hostel.capacity) * 100)
              : null;
            return (
              <Card key={hostel.id} hover>
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{hostel.name}</h3>
                      <Badge variant={hostel.type === 'boys' ? 'info' : 'default'}>{hostel.type === 'boys' ? 'Boys' : 'Girls'}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Warden: {hostel.warden_id ? wardenNames.get(hostel.warden_id) || (wardensError ? 'Profile unavailable' : 'Warden profile not found') : 'Not assigned'}
                    </p>
                    {hostel.address && <p className="mt-0.5 text-xs text-gray-500">{hostel.address}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-500">Rooms: </span><span className="font-semibold text-gray-800">{hostel.room_count ?? 'Unavailable'}</span></div>
                      <div><span className="text-gray-500">Residents: </span><span className="font-semibold text-gray-800">{hostel.resident_count === null || hostel.capacity === null ? 'Unavailable' : `${hostel.resident_count} / ${hostel.capacity}`}</span></div>
                    </div>
                    <div className="mt-2.5">
                      <div className="mb-1 flex justify-between text-[11px] text-gray-500"><span>Occupancy</span><span className="font-medium text-gray-700">{occupancy === null ? 'Unavailable' : `${occupancy}%`}</span></div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.min(occupancy ?? 0, 100)}%` }} /></div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(hostel)} disabled={!isConfigured}>Edit</Button>
                      <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => { setActionError(null); setSuccessMessage(null); setDeletingHostel(hostel); }}
                        disabled={!isConfigured || (hostel.room_count ?? 1) > 0}
                        title={(hostel.room_count ?? 1) > 0 ? 'Only hostels with no rooms or students can be deleted' : undefined}>Delete</Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={() => !saving && setIsOpen(false)} title={editingHostel ? 'Edit Hostel' : 'Add Hostel'} size="md"
        footer={<><Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" form="hostel-form" isLoading={saving}>{editingHostel ? 'Save Changes' : 'Create Hostel'}</Button></>}>
        <form id="hostel-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="Hostel name" value={draft.name} onChange={(event) => setField('name', event.target.value)} required maxLength={120} disabled={saving} />
          <Select label="Hostel type" value={draft.type} onChange={(event) => { const type = event.target.value; if (type === 'boys' || type === 'girls') setField('type', type); }} options={[{ value: 'boys', label: 'Boys' }, { value: 'girls', label: 'Girls' }]} disabled={saving} />
          <Select label="Warden (optional)" value={draft.warden_id} onChange={(event) => setField('warden_id', event.target.value)} placeholder={wardensLoading ? 'Loading wardens…' : 'No warden assigned'} options={wardens.map((warden) => ({ value: warden.id, label: warden.full_name }))} disabled={saving || wardensLoading || Boolean(wardensError)} />
          <Input label="Address (optional)" value={draft.address} onChange={(event) => setField('address', event.target.value)} maxLength={300} disabled={saving} />
          {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
          <p className="text-xs text-gray-500">Room totals and occupancy are calculated from room records and students with a room allocation. Creating a hostel does not create rooms or student records.</p>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingHostel)}
        onClose={() => { if (!deleting) setDeletingHostel(null); }}
        onConfirm={() => void handleDelete()}
        title="Delete hostel"
        message={`Delete ${deletingHostel?.name || 'this hostel'}? This also deletes its hostel-specific notices. Hostels that still have rooms or students cannot be deleted.`}
        confirmLabel="Delete Hostel"
        isLoading={deleting}
      />
    </div>
  );
}
