import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Hostel } from '../types';

export const mockHostels: Hostel[] = [
  {
    id: 'hostel-1',
    name: 'Hostel Mandakini',
    type: 'boys',
    total_rooms: 64,
    address: 'North Campus, Sector 2',
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'hostel-2',
    name: 'Hostel Alakananda',
    type: 'boys',
    total_rooms: 60,
    address: 'North Campus, Sector 3',
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'hostel-3',
    name: 'Hostel Kaveri',
    type: 'girls',
    total_rooms: 68,
    address: 'South Campus, Block A',
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'hostel-4',
    name: 'Hostel Yamuna',
    type: 'girls',
    total_rooms: 60,
    address: 'South Campus, Block B',
    created_at: '2026-08-01T00:00:00Z',
  },
];

export async function getHostels(filters?: { wardenId?: string }): Promise<{ data: Hostel[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const hostels = filters?.wardenId
      ? mockHostels.filter((hostel) => hostel.warden_id === filters.wardenId)
      : mockHostels;
    return { data: hostels, error: null };
  }

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
  if (!isSupabaseConfigured) {
    const found = mockHostels.find((h) => h.id === id) || null;
    return { data: found, error: found ? null : 'Hostel not found' };
  }

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
  payload: Omit<Hostel, 'id' | 'created_at'>
): Promise<{ data: Hostel | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const newHostel: Hostel = {
      ...payload,
      id: `hostel-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    mockHostels.push(newHostel);
    return { data: newHostel, error: null };
  }

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
