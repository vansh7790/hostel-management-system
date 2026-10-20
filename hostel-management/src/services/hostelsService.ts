import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Hostel } from '../types';

export interface HostelDirectoryEntry extends Hostel {
  room_count: number | null;
  capacity: number | null;
  resident_count: number | null;
}

export interface HostelWarden {
  id: string;
  full_name: string;
}

const configurationError = 'Supabase is not configured. Hostel records are unavailable until a database connection is configured.';

export async function getHostels(filters?: { wardenId?: string }): Promise<{ data: Hostel[] | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: configurationError };

  try {
    let query = supabase.from('hostels').select('*');
    if (filters?.wardenId) query = query.eq('warden_id', filters.wardenId);
    const { data, error } = await query.order('name');

    if (error) return { data: null, error: error.message };
    return { data: data as Hostel[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch hostels';
    return { data: null, error: message };
  }
}

export async function getHostelById(id: string): Promise<{ data: Hostel | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: configurationError };

  try {
    const { data, error } = await supabase
      .from('hostels')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Hostel, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch hostel';
    return { data: null, error: message };
  }
}

export async function createHostel(
  payload: Pick<Hostel, 'name' | 'type'> & Partial<Pick<Hostel, 'warden_id' | 'address'>>
): Promise<{ data: Hostel | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: configurationError };

  try {
    const { data, error } = await supabase
      .from('hostels')
      .insert([payload])
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Hostel, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create hostel';
    return { data: null, error: message };
  }
}

export async function getHostelWardens(): Promise<{ data: HostelWarden[] | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: configurationError };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'warden')
      .order('full_name');

    if (error) return { data: null, error: error.message };
    return { data: data as HostelWarden[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch warden profiles';
    return { data: null, error: message };
  }
}

export async function getHostelDirectory(): Promise<{
  data: HostelDirectoryEntry[] | null;
  error: string | null;
  metricsError: string | null;
}> {
  if (!isSupabaseConfigured) return { data: null, error: configurationError, metricsError: null };

  try {
    const [hostelsResult, roomsResult, studentsResult] = await Promise.all([
      supabase.from('hostels').select('*').order('name'),
      supabase.from('rooms').select('id, hostel_id, capacity'),
      supabase.from('students').select('room_id').not('room_id', 'is', null),
    ]);

    if (hostelsResult.error) return { data: null, error: hostelsResult.error.message, metricsError: null };

    const rooms = (roomsResult.data || []) as Array<{ id: string; hostel_id: string; capacity: number }>;
    const roomHostelById = new Map(rooms.map((room) => [room.id, room.hostel_id]));
    const roomCounts = new Map<string, number>();
    const capacities = new Map<string, number>();
    const residentCounts = new Map<string, number>();

    for (const room of rooms) {
      roomCounts.set(room.hostel_id, (roomCounts.get(room.hostel_id) || 0) + 1);
      capacities.set(room.hostel_id, (capacities.get(room.hostel_id) || 0) + room.capacity);
    }

    if (!roomsResult.error && !studentsResult.error) {
      for (const student of (studentsResult.data || []) as Array<{ room_id: string | null }>) {
        const hostelId = student.room_id ? roomHostelById.get(student.room_id) : undefined;
        if (hostelId) residentCounts.set(hostelId, (residentCounts.get(hostelId) || 0) + 1);
      }
    }

    const hostels = (hostelsResult.data || []) as Hostel[];
    return {
      data: hostels.map((hostel) => ({
        ...hostel,
        room_count: roomsResult.error ? null : roomCounts.get(hostel.id) || 0,
        capacity: roomsResult.error ? null : capacities.get(hostel.id) || 0,
        resident_count: roomsResult.error || studentsResult.error ? null : residentCounts.get(hostel.id) || 0,
      })),
      error: null,
      metricsError: [
        roomsResult.error && `Could not load room counts and capacity: ${roomsResult.error.message}`,
        studentsResult.error && `Could not load allocated resident counts: ${studentsResult.error.message}`,
      ].filter(Boolean).join(' ') || null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load hostel directory';
    return { data: null, error: message, metricsError: null };
  }
}
