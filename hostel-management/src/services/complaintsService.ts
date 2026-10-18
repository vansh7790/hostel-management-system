import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Complaint, ComplaintStatus } from '../types';

export const mockComplaints: Complaint[] = [
  {
    id: 'complaint-1',
    student_id: 'student-1',
    title: 'Ceiling fan speed regulator replacement',
    category: 'electrical',
    description: 'Regulator is stuck at speed 5 and sparking slightly.',
    room_id: 'room-1',
    status: 'in_progress',
    created_at: '2026-10-01T10:30:00Z',
    updated_at: '2026-10-01T12:00:00Z',
  },
  {
    id: 'complaint-2',
    student_id: 'student-2',
    title: 'Study desk drawer broken',
    category: 'furniture',
    description: 'Bottom slider of study table drawer came off.',
    room_id: 'room-1',
    status: 'pending',
    created_at: '2026-10-01T14:15:00Z',
    updated_at: '2026-10-01T14:15:00Z',
  },
  {
    id: 'complaint-3',
    student_id: 'student-3',
    title: 'Bathroom tap washer worn out',
    category: 'plumbing',
    description: 'Continuous dripping from cold water faucet.',
    room_id: 'room-4',
    status: 'pending',
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:00:00Z',
  },
];

export async function getComplaints(filters?: {
  status?: ComplaintStatus;
  studentId?: string;
  category?: string;
}): Promise<{ data: Complaint[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    let list = [...mockComplaints];
    if (filters?.status) list = list.filter((c) => c.status === filters.status);
    if (filters?.studentId) list = list.filter((c) => c.student_id === filters.studentId);
    if (filters?.category) list = list.filter((c) => c.category === filters.category);
    return { data: list, error: null };
  }

  try {
    let query = supabase
      .from('complaints')
      .select('*, student:students(*, room:rooms(*)), room:rooms(*)');

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
    const found = mockComplaints.find((c) => c.id === id) || null;
    return { data: found, error: found ? null : 'Complaint not found' };
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
    const newComplaint: Complaint = {
      ...payload,
      id: `complaint-${Date.now()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockComplaints.unshift(newComplaint);
    return { data: newComplaint, error: null };
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
    const idx = mockComplaints.findIndex((c) => c.id === id);
    if (idx >= 0) {
      mockComplaints[idx].status = status;
      mockComplaints[idx].updated_at = new Date().toISOString();
      return { data: mockComplaints[idx], error: null };
    }
    return { data: null, error: 'Complaint not found' };
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
