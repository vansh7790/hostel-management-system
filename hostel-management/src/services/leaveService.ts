import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { LeaveRequest, LeaveStatus } from '../types';

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 'leave-1',
    student_id: 'student-1',
    reason: 'Family Medical Emergency',
    destination: 'Jaipur, Rajasthan',
    start_date: '2026-10-02',
    end_date: '2026-10-04',
    emergency_contact: '+91 98765 01234',
    message: 'Attending to family medical matter at home.',
    status: 'approved',
    remark: 'Approved by resident warden',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T09:30:00Z',
  },
  {
    id: 'leave-2',
    student_id: 'student-3',
    reason: 'Inter-College Fest',
    destination: 'Pune, Maharashtra',
    start_date: '2026-10-05',
    end_date: '2026-10-08',
    emergency_contact: '+91 98765 43224',
    message: 'Selected for college cultural team performance.',
    status: 'pending',
    created_at: '2026-10-01T11:00:00Z',
    updated_at: '2026-10-01T11:00:00Z',
  },
];

export async function getLeaveRequests(filters?: {
  status?: LeaveStatus;
  studentId?: string;
}): Promise<{ data: LeaveRequest[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    let list = [...mockLeaveRequests];
    if (filters?.status) list = list.filter((l) => l.status === filters.status);
    if (filters?.studentId) list = list.filter((l) => l.student_id === filters.studentId);
    return { data: list, error: null };
  }

  try {
    let query = supabase
      .from('leave_requests')
      .select('*, student:students(*, room:rooms(*))');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as LeaveRequest[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch leave requests';
    return { data: null, error: message };
  }
}

export async function getLeaveRequestById(
  id: string
): Promise<{ data: LeaveRequest | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const found = mockLeaveRequests.find((l) => l.id === id) || null;
    return { data: found, error: found ? null : 'Leave request not found' };
  }

  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, student:students(*)')
      .eq('id', id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as LeaveRequest, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch leave request';
    return { data: null, error: message };
  }
}

export async function createLeaveRequest(
  payload: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at' | 'status' | 'remark' | 'approved_by' | 'student'>
): Promise<{ data: LeaveRequest | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const newRequest: LeaveRequest = {
      ...payload,
      id: `leave-${Date.now()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockLeaveRequests.unshift(newRequest);
    return { data: newRequest, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert([
        {
          ...payload,
          status: 'pending',
        },
      ])
      .select('*, student:students(*)')
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as LeaveRequest, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit leave request';
    return { data: null, error: message };
  }
}

export async function updateLeaveStatus(
  id: string,
  status: LeaveStatus,
  remark?: string,
  approvedBy?: string
): Promise<{ data: LeaveRequest | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const idx = mockLeaveRequests.findIndex((l) => l.id === id);
    if (idx >= 0) {
      mockLeaveRequests[idx].status = status;
      if (remark !== undefined) mockLeaveRequests[idx].remark = remark;
      if (approvedBy !== undefined) mockLeaveRequests[idx].approved_by = approvedBy;
      mockLeaveRequests[idx].updated_at = new Date().toISOString();
      return { data: mockLeaveRequests[idx], error: null };
    }
    return { data: null, error: 'Leave request not found' };
  }

  try {
    const updatePayload: {
      status: LeaveStatus;
      updated_at: string;
      remark?: string;
      approved_by?: string;
    } = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (remark !== undefined) updatePayload.remark = remark;
    if (approvedBy !== undefined) updatePayload.approved_by = approvedBy;

    const { data, error } = await supabase
      .from('leave_requests')
      .update(updatePayload)
      .eq('id', id)
      .select('*, student:students(*)')
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as LeaveRequest, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update leave request status';
    return { data: null, error: message };
  }
}
