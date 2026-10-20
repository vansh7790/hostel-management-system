import { useCallback, useEffect, useState } from 'react';
import { BedDouble, Search, User } from 'lucide-react';
import { PageHeader } from '../../components/layout';
import { Badge, Button, Card, Input, Modal, Select } from '../../components/ui';
import { assignRoom, getRooms, getStudents } from '../../services';
import type { Room, Student } from '../../types';

type Filter = 'pending' | 'allocated' | 'all';

/**
 * Admin allocation desk: allocate, transfer, or release rooms. The database
 * validates room existence/capacity, derives hostel_id from the room, and keeps
 * room occupancy in sync; this page only reports what the database confirms.
 */
export default function AdminAllocations() {
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [target, setTarget] = useState<Student | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [studentResult, roomResult] = await Promise.all([getStudents(), getRooms()]);
    const errors = [studentResult.error, roomResult.error].filter(Boolean);
    return {
      error: errors.length ? `Could not load allocation data: ${errors.join(' ')}` : null,
      students: studentResult.data || [],
      rooms: roomResult.data || [],
    };
  }, []);

  const apply = (result: Awaited<ReturnType<typeof fetchAll>>) => {
    setError(result.error);
    setStudents(result.students);
    setRooms(result.rooms);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    fetchAll().then((result) => { if (active) apply(result); });
    return () => { active = false; };
  }, [fetchAll]);

  const reload = async () => apply(await fetchAll());

  const openFor = (student: Student) => {
    setTarget(student);
    setSelectedRoomId('');
    setModalError(null);
    setSuccess(null);
  };

  const eligibleRooms = target
    ? rooms
      .filter((room) => room.id !== target.room_id && room.status !== 'maintenance' && room.current_occupants < room.capacity)
      // Prefer the student's intended hostel, then the rest.
      .sort((a, b) => Number(b.hostel_id === target.intended_hostel_id) - Number(a.hostel_id === target.intended_hostel_id)
        || (a.hostel?.name || '').localeCompare(b.hostel?.name || '') || a.room_number.localeCompare(b.room_number))
    : [];

  const save = async (roomId: string | null) => {
    if (!target || saving) return;
    setSaving(true);
    setModalError(null);
    const result = await assignRoom(target.id, roomId);
    setSaving(false);
    if (result.error || !result.data || result.source !== 'supabase' || (result.data.room_id || null) !== roomId) {
      setModalError(result.error || 'The database did not confirm the allocation change.');
      return;
    }
    const room = rooms.find((item) => item.id === roomId);
    setSuccess(roomId
      ? `${target.name} ${target.room_id ? 'transferred' : 'allocated'} to ${room?.hostel?.name || 'hostel'} room ${room?.room_number || ''}.`
      : `${target.name}'s room was released. The student is back in the pending queue.`);
    setTarget(null);
    setLoading(true);
    await reload();
  };

  const term = search.trim().toLowerCase();
  const visible = students
    .filter((student) => filter === 'all' || (filter === 'pending' ? !student.room_id : Boolean(student.room_id)))
    .filter((student) => !term || [student.name, student.student_id, student.email].some((value) => value.toLowerCase().includes(term)));
  const pendingCount = students.filter((student) => !student.room_id).length;

  return (
    <div>
      <PageHeader title="Room Allocations" description="Allocate, transfer, or release student rooms across all hostels." />
      {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <div className="mb-4"><Input placeholder="Search by name, student ID, or email..." leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={filter === 'pending' ? 'primary' : 'outline'} onClick={() => setFilter('pending')}>Pending ({pendingCount})</Button>
        <Button size="sm" variant={filter === 'allocated' ? 'primary' : 'outline'} onClick={() => setFilter('allocated')}>Allocated ({students.length - pendingCount})</Button>
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>All ({students.length})</Button>
      </div>

      {loading ? <Card><p role="status" className="text-sm text-gray-500">Loading students and rooms...</p></Card> : visible.length === 0 ? (
        <Card><p role="status" className="text-sm text-gray-500">{filter === 'pending' ? 'No students are waiting for a room.' : 'No students match this view.'}</p></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((student) => (
            <Card key={student.id} padding="sm">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center"><User className="h-5 w-5 text-gray-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{student.name} <span className="text-sm font-normal text-gray-500">· {student.student_id}</span></p>
                  <p className="text-sm text-gray-500">
                    {student.room_id
                      ? `${student.actual_hostel?.name || 'Hostel'} · Room ${student.room?.room_number || '—'}`
                      : `Intended: ${student.intended_hostel?.name || 'not set'}`}
                  </p>
                </div>
                <Badge variant={student.room_id ? 'success' : 'warning'} dot>{student.room_id ? 'Allocated' : 'Pending'}</Badge>
                <Button size="sm" variant={student.room_id ? 'outline' : 'primary'} leftIcon={<BedDouble className="h-4 w-4" />} onClick={() => openFor(student)}>
                  {student.room_id ? 'Transfer / Release' : 'Allocate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(target)} onClose={() => { if (!saving) setTarget(null); }} title={target?.room_id ? 'Transfer or Release Room' : 'Allocate Room'}
        footer={<>
          {target?.room_id && <Button variant="outline" onClick={() => void save(null)} isLoading={saving} disabled={saving}>Release Room</Button>}
          <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save(selectedRoomId)} isLoading={saving} disabled={saving || !selectedRoomId}>{target?.room_id ? 'Transfer' : 'Allocate'}</Button>
        </>}>
        {target && <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {target.name}{target.room_id ? ` is currently in ${target.actual_hostel?.name || 'a hostel'} room ${target.room?.room_number || ''}.` : ` is waiting for a room${target.intended_hostel?.name ? ` in ${target.intended_hostel.name}` : ''}.`}
          </p>
          {eligibleRooms.length === 0 ? (
            <p role="status" className="text-sm text-amber-700">No rooms with free beds are available. Add rooms or free a bed first.</p>
          ) : (
            <Select label="Room with free beds" value={selectedRoomId} onChange={(e) => { setSelectedRoomId(e.target.value); setModalError(null); }} disabled={saving}
              placeholder="Select a room"
              options={eligibleRooms.map((room) => ({
                value: room.id,
                label: `${room.hostel?.name || 'Hostel'} · Room ${room.room_number} · ${room.current_occupants}/${room.capacity}${room.hostel_id === target.intended_hostel_id ? ' (intended hostel)' : ''}`,
              }))} />
          )}
          {modalError && <p role="alert" className="text-sm text-rose-700">{modalError}</p>}
        </div>}
      </Modal>
    </div>
  );
}
