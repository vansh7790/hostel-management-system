import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Notice } from '../types';

export const mockNotices: Notice[] = [
  {
    id: 'notice-1',
    title: 'Water Supply Maintenance',
    description: 'Overhead tank cleaning scheduled for Oct 2 (09:00 AM - 01:00 PM). Please store water accordingly.',
    priority: 'high',
    posted_by: 'warden-1',
    poster_name: 'Dr. Singh',
    hostel_id: 'hostel-1',
    created_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'notice-2',
    title: 'Revised Hostel Gate Timings',
    description: 'All residents must report inside campus gates before 10:00 PM on weekdays.',
    priority: 'medium',
    posted_by: 'admin-1',
    poster_name: 'Campus Admin',
    created_at: '2026-09-29T10:00:00Z',
  },
  {
    id: 'notice-3',
    title: 'Wi-Fi Speed Upgrade in Wing B',
    description: 'New access points deployed on 2nd and 3rd floors for enhanced network speed.',
    priority: 'low',
    posted_by: 'admin-1',
    poster_name: 'IT Cell',
    hostel_id: 'hostel-1',
    created_at: '2026-09-26T14:30:00Z',
  },
];

export async function getNotices(
  hostelId?: string
): Promise<{ data: Notice[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    let list = [...mockNotices];
    if (hostelId) {
      list = list.filter((n) => !n.hostel_id || n.hostel_id === hostelId);
    }
    return { data: list, error: null };
  }

  try {
    let query = supabase
      .from('notices')
      .select('*, poster:profiles(full_name)');

    if (hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${hostelId}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };

    // Format poster name from join if present
    const formatted: Notice[] = (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      title: String(row.title),
      description: String(row.description),
      priority: row.priority as Notice['priority'],
      posted_by: String(row.posted_by),
      poster_name: (row.poster as { full_name?: string } | null)?.full_name || 'Hostel Administration',
      hostel_id: row.hostel_id ? String(row.hostel_id) : undefined,
      created_at: String(row.created_at),
    }));

    return { data: formatted, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notices';
    return { data: null, error: message };
  }
}

export async function createNotice(
  payload: Omit<Notice, 'id' | 'created_at' | 'poster_name'>
): Promise<{ data: Notice | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const newNotice: Notice = {
      ...payload,
      id: `notice-${Date.now()}`,
      created_at: new Date().toISOString(),
      poster_name: 'Current User',
    };
    mockNotices.unshift(newNotice);
    return { data: newNotice, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('notices')
      .insert([payload])
      .select('*, poster:profiles(full_name)')
      .single();

    if (error) return { data: null, error: error.message };

    const formatted: Notice = {
      id: String(data.id),
      title: String(data.title),
      description: String(data.description),
      priority: data.priority as Notice['priority'],
      posted_by: String(data.posted_by),
      poster_name: (data.poster as { full_name?: string } | null)?.full_name || 'Hostel Administration',
      hostel_id: data.hostel_id ? String(data.hostel_id) : undefined,
      created_at: String(data.created_at),
    };

    return { data: formatted, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create notice';
    return { data: null, error: message };
  }
}

export async function deleteNotice(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    const idx = mockNotices.findIndex((n) => n.id === id);
    if (idx >= 0) {
      mockNotices.splice(idx, 1);
      return { success: true, error: null };
    }
    return { success: false, error: 'Notice not found' };
  }

  try {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete notice';
    return { success: false, error: message };
  }
}
