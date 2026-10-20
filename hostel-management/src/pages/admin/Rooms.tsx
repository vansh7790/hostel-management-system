import { useEffect, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Button, Card, Input, Modal, Select } from '../../components/ui';
import { useAuth } from '../../context';
import { createRoom, getHostels, getRooms, updateRoom } from '../../services';
import type { Hostel, Room } from '../../types';

type RoomDraft = {
  hostel_id: string;
  room_number: string;
  floor: string;
  capacity: string;
};

const emptyDraft: RoomDraft = { hostel_id: '', room_number: '', floor: '1', capacity: '2' };

function formatCreateError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('uq_hostel_room') || normalized.includes('duplicate key') || normalized.includes('unique constraint')) {
    return `A room with this number already exists in the selected hostel. Database details: ${message}`;
  }
  if (normalized.includes('row-level security') || normalized.includes('permission denied') || normalized.includes('not allowed')) {
    return `Supabase denied permission to create this room. Check the deployed room INSERT policy for this admin account. Database details: ${message}`;
  }
  return `Could not create room. Database details: ${message}`;
}

export default function AdminRooms() {
  const { isConfigured } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [hostelsLoading, setHostelsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [hostelsError, setHostelsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<RoomDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editDraft, setEditDraft] = useState({ floor: '1', capacity: '1', maintenance: 'no' });
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setEditDraft({ floor: String(room.floor), capacity: String(room.capacity), maintenance: room.status === 'maintenance' ? 'yes' : 'no' });
    setEditError(null);
    setSuccessMessage(null);
  };

  // The database recomputes occupancy/full status and rejects capacity below current occupancy.
  const handleEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRoom) return;
    const floor = Number(editDraft.floor);
    const capacity = Number(editDraft.capacity);
    if (!Number.isInteger(floor) || floor < 1) {
      setEditError('Floor must be a positive whole number.');
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      setEditError('Capacity must be a positive whole number.');
      return;
    }
    if (capacity < editingRoom.current_occupants) {
      setEditError(`Capacity cannot be lower than the ${editingRoom.current_occupants} current occupant(s). Move students first.`);
      return;
    }
    setSaving(true);
    const result = await updateRoom(editingRoom.id, { floor, capacity, status: editDraft.maintenance === 'yes' ? 'maintenance' : 'available' });
    setSaving(false);
    if (result.error || !result.data?.id) {
      setEditError(`Could not update room. ${result.error || 'The database did not confirm the update.'}`);
      return;
    }
    setEditingRoom(null);
    setSuccessMessage(`Room ${result.data.room_number} updated.`);
    setRoomsLoading(true);
    setRefreshKey((current) => current + 1);
  };

  useEffect(() => {
    let active = true;

    Promise.all([getRooms(), getHostels()]).then(([roomsResult, hostelsResult]) => {
      if (!active) return;

      setRooms(roomsResult.data || []);
      setRoomsError(roomsResult.error ? `Could not load rooms: ${roomsResult.error}` : null);
      setRoomsLoading(false);

      setHostels(hostelsResult.data || []);
      setHostelsError(hostelsResult.error ? `Could not load hostels: ${hostelsResult.error}` : null);
      setHostelsLoading(false);
    });

    return () => { active = false; };
  }, [refreshKey]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setFormError(null);
    setSuccessMessage(null);
    setIsOpen(true);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const floor = Number(draft.floor);
    const capacity = Number(draft.capacity);
    if (!draft.hostel_id || !hostels.some((hostel) => hostel.id === draft.hostel_id)) {
      setFormError('Select a valid hostel.');
      return;
    }
    if (!draft.room_number.trim()) {
      setFormError('Enter a room number.');
      return;
    }
    if (!Number.isInteger(floor) || floor < 1) {
      setFormError('Floor must be a positive whole number.');
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      setFormError('Capacity must be a positive whole number.');
      return;
    }

    setSaving(true);
    const result = await createRoom({
      hostel_id: draft.hostel_id,
      room_number: draft.room_number.trim(),
      floor,
      capacity,
    });
    setSaving(false);

    if (result.error || !result.data?.id) {
      const message = result.error || 'The database did not confirm that the room was created.';
      setFormError(formatCreateError(message));
      return;
    }

    setIsOpen(false);
    setSuccessMessage(`Room ${result.data.room_number} was created in ${hostels.find((hostel) => hostel.id === result.data?.hostel_id)?.name || 'the selected hostel'}.`);
    setRoomsLoading(true);
    setRefreshKey((current) => current + 1);
  };

  const visibleRooms = rooms.filter((room) => {
    const hostelName = room.hostel?.name || hostels.find((hostel) => hostel.id === room.hostel_id)?.name || '';
    const query = search.trim().toLowerCase();
    return !query || room.room_number.toLowerCase().includes(query) || hostelName.toLowerCase().includes(query);
  });

  return (
    <div>
      <PageHeader title="Rooms" description="Manage all rooms across hostels." action={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!isConfigured || hostelsLoading || Boolean(hostelsError) || hostels.length === 0}>
          Add Room
        </Button>
      } />
      {!isConfigured && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Supabase is not configured. Room data below is demo-only; connect Supabase to create persistent rooms.</p>}
      {roomsError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{roomsError}</p>}
      {hostelsError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{hostelsError}</p>}
      {successMessage && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</p>}
      {!hostelsLoading && !hostelsError && hostels.length === 0 && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Create a hostel before adding rooms.</p>}

      <div className="mb-6">
        <Input placeholder="Search rooms..." leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {roomsLoading ? <Card><p role="status" className="text-sm text-gray-500">Loading rooms...</p></Card> : roomsError ? (
        <Card><p className="text-sm text-rose-700">Room records could not be loaded. Resolve the error above and retry.</p></Card>
      ) : visibleRooms.length === 0 ? (
        <Card><p className="text-sm text-gray-500">{search.trim() ? 'No rooms match your search.' : 'No rooms have been created yet.'}</p></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleRooms.map((room) => {
            const hostelName = room.hostel?.name || hostels.find((hostel) => hostel.id === room.hostel_id)?.name || 'Hostel unavailable';
            const badgeVariant = room.status === 'full' ? 'danger' : room.status === 'maintenance' ? 'warning' : 'success';
            return <Card key={room.id} hover>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">{room.room_number}</h3>
                <Badge variant={badgeVariant} dot>{room.status === 'full' ? 'Full' : room.status === 'maintenance' ? 'Maintenance' : 'Available'}</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Hostel</span><span className="font-medium">{hostelName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Floor</span><span className="font-medium">{room.floor}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Occupancy</span><span className="font-medium">{room.current_occupants}/{room.capacity}</span></div>
              </div>
              <div className="mt-3 bg-gray-100 rounded-full h-2"><div className="bg-primary-600 h-2 rounded-full" style={{ width: `${Math.min((room.current_occupants / room.capacity) * 100, 100)}%` }} /></div>
              <Button className="mt-4 w-full" size="sm" variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(room)} disabled={!isConfigured}>Edit Room</Button>
            </Card>;
          })}
        </div>
      )}

      <Modal
        isOpen={Boolean(editingRoom)}
        onClose={() => { if (!saving) setEditingRoom(null); }}
        title={`Edit Room ${editingRoom?.room_number || ''}`}
        footer={<>
          <Button variant="outline" onClick={() => setEditingRoom(null)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="room-edit-form" isLoading={saving}>Save Changes</Button>
        </>}
      >
        <form id="room-edit-form" onSubmit={(event) => void handleEdit(event)} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Floor" type="number" min="1" step="1" value={editDraft.floor} onChange={(event) => setEditDraft((current) => ({ ...current, floor: event.target.value }))} required disabled={saving} />
            <Input label="Capacity" type="number" min="1" step="1" value={editDraft.capacity} onChange={(event) => setEditDraft((current) => ({ ...current, capacity: event.target.value }))} required disabled={saving} />
          </div>
          <Select label="Under maintenance" value={editDraft.maintenance} onChange={(event) => setEditDraft((current) => ({ ...current, maintenance: event.target.value }))} disabled={saving}
            options={[{ value: 'no', label: 'No — available for allocation' }, { value: 'yes', label: 'Yes — block new allocations' }]} />
          <p className="text-xs text-gray-500">Occupancy is counted from allocated students; full/available status is set automatically.</p>
          {editError && <p role="alert" className="text-sm text-rose-700">{editError}</p>}
        </form>
      </Modal>

      <Modal
        isOpen={isOpen}
        onClose={() => { if (!saving) setIsOpen(false); }}
        title="Add Room"
        footer={<>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="room-form" isLoading={saving}>Create Room</Button>
        </>}
      >
        <form id="room-form" onSubmit={(event) => void handleCreate(event)} className="space-y-4">
          <Select
            label="Hostel"
            value={draft.hostel_id}
            onChange={(event) => setDraft((current) => ({ ...current, hostel_id: event.target.value }))}
            options={hostels.map((hostel) => ({ value: hostel.id, label: hostel.name }))}
            placeholder={hostelsLoading ? 'Loading hostels...' : 'Select a hostel'}
            required
            disabled={saving || hostelsLoading || Boolean(hostelsError)}
          />
          <Input label="Room number" value={draft.room_number} onChange={(event) => setDraft((current) => ({ ...current, room_number: event.target.value }))} required disabled={saving} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Floor" type="number" min="1" step="1" value={draft.floor} onChange={(event) => setDraft((current) => ({ ...current, floor: event.target.value }))} required disabled={saving} />
            <Input label="Capacity" type="number" min="1" step="1" value={draft.capacity} onChange={(event) => setDraft((current) => ({ ...current, capacity: event.target.value }))} required disabled={saving} />
          </div>
          <p className="text-xs text-gray-500">New rooms start with zero occupants and available status.</p>
          {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
