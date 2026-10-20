import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Complaint, ComplaintStatus } from '../types';

const configurationError = 'Supabase is not configured. Live complaint records are unavailable.';

export async function getComplaints(filters?: {
  status?: ComplaintStatus;
  studentId?: string;
  category?: string;
}): Promise<{ data: Complaint[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: configurationError };
  }

  try {
    let query = supabase
      .from('complaints')
      .select('*, student:students(*, room:rooms(*), actual_hostel:hostels!students_hostel_id_fkey(*)), room:rooms(*, hostel:hostels(*))');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.studentId) {
      query = query.eq('student_id', filters.studentId);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as Complaint[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch complaints';
    return { data: null, error: message };
  }
}

export async function getComplaintById(
  id: string
): Promise<{ data: Complaint | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: configurationError };
  }

  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('*, student:students(*), room:rooms(*)')
      .eq('id', id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Complaint, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch complaint';
    return { data: null, error: message };
  }
}

export async function createComplaint(
  payload: Omit<Complaint, 'id' | 'created_at' | 'updated_at' | 'status' | 'student' | 'room'>
): Promise<{ data: Complaint | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: configurationError };
  }

  try {
    const { data, error } = await supabase
      .from('complaints')
      .insert([
        {
          ...payload,
          status: 'pending',
        },
      ])
      .select('*, student:students(*), room:rooms(*)')
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Complaint, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit complaint';
    return { data: null, error: message };
  }
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus
): Promise<{ data: Complaint | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: configurationError };
  }

  try {
    const { data, error } = await supabase
      .from('complaints')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, student:students(*), room:rooms(*)')
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Complaint, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update complaint status';
    return { data: null, error: message };
  }
}
