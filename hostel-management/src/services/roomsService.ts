import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Room } from '../types';

export const mockRooms: Room[] = [
  {
    id: 'room-1',
    room_number: 'B-204',
    hostel_id: 'hostel-1',
    floor: 2,
    capacity: 2,
    current_occupants: 2,
    status: 'full',
  },
  {
    id: 'room-2',
    room_number: 'B-205',
    hostel_id: 'hostel-1',
    floor: 2,
    capacity: 2,
    current_occupants: 1,
    status: 'available',
  },
  {
    id: 'room-3',
    room_number: 'A-101',
    hostel_id: 'hostel-2',
    floor: 1,
    capacity: 3,
    current_occupants: 2,
    status: 'available',
  },
  {
    id: 'room-4',
    room_number: 'C-301',
    hostel_id: 'hostel-3',
    floor: 3,
    capacity: 2,
    current_occupants: 0,
    status: 'available',
  },
];

export async function getRooms(
  hostelId?: string
): Promise<{ data: Room[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const list = hostelId ? mockRooms.filter((r) => r.hostel_id === hostelId) : mockRooms;
    return { data: list, error: null };
  }

  try {
    let query = supabase
      .from('rooms')
      .select('*, hostel:hostels(*)');

    if (hostelId) {
      query = query.eq('hostel_id', hostelId);
    }

    const { data, error } = await query.order('room_number');

    if (error) return { data: null, error: error.message };
    return { data: data as Room[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch rooms';
    return { data: null, error: message };
  }
}

export async function getRoomById(
  id: string
): Promise<{ data: Room | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const room = mockRooms.find((r) => r.id === id) || null;
    return { data: room, error: room ? null : 'Room not found' };
  }

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, hostel:hostels(*)')
      .eq('id', id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Room, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch room';
    return { data: null, error: message };
  }
}

export async function createRoom(
  payload: Omit<Room, 'id' | 'current_occupants' | 'status'> & { status?: Room['status'] }
): Promise<{ data: Room | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const newRoom: Room = {
      ...payload,
      id: `room-${Date.now()}`,
      current_occupants: 0,
      status: payload.status || 'available',
    };
    mockRooms.push(newRoom);
    return { data: newRoom, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('rooms')
      .insert([
        {
          ...payload,
          current_occupants: 0,
          status: payload.status || 'available',
        },
      ])
      .select('*, hostel:hostels(*)')
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Room, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create room';
    return { data: null, error: message };
  }
}

export async function updateRoom(
  id: string,
  payload: Partial<Room>
): Promise<{ data: Room | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const idx = mockRooms.findIndex((r) => r.id === id);
    if (idx >= 0) {
      mockRooms[idx] = { ...mockRooms[idx], ...payload };
      return { data: mockRooms[idx], error: null };
    }
    return { data: null, error: 'Room not found' };
  }

  try {
    const { data, error } = await supabase
      .from('rooms')
      .update(payload)
      .eq('id', id)
      .select('*, hostel:hostels(*)')
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Room, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update room';
    return { data: null, error: message };
  }
}
