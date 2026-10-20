import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Student } from '../types';

const STUDENT_SELECT = '*, actual_hostel:hostels!students_hostel_id_fkey(*), room:rooms(*), intended_hostel:hostels!students_intended_hostel_id_fkey(*)';

export type StudentDataSource = 'supabase' | 'demo';

interface StudentResult<T> {
  data: T;
  error: string | null;
  source: StudentDataSource;
  warning?: string | null;
}

type StudentCreatePayload = Pick<Student, 'student_id' | 'name' | 'email'> &
  Partial<Pick<Student, 'phone' | 'department' | 'year' | 'guardian_name' | 'guardian_phone' | 'address' | 'intended_hostel_id'>>;

type StudentUpdatePayload = Partial<Pick<
  Student,
  'student_id' | 'name' | 'email' | 'phone' | 'department' | 'year' | 'guardian_name' | 'guardian_phone' | 'address' | 'intended_hostel_id'
>>;

export const mockStudents: Student[] = [
  {
    id: 'student-1', user_id: 'demo-student-id', student_id: 'STU2024001', name: 'Aarav Sharma',
    email: 'student@hostelhub.com', phone: '+91 98765 01234', department: 'Computer Science', year: 3,
    hostel_id: 'hostel-1', room_id: 'room-1', guardian_name: 'Rajesh Sharma',
    guardian_phone: '+91 98765 88990', address: 'Jaipur, Rajasthan', created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'student-2', user_id: 'user-2', student_id: 'STU2024015', name: 'Rohan Sharma',
    email: 'rohan.sharma@college.edu', phone: '+91 98765 43215', department: 'Computer Science', year: 3,
    hostel_id: 'hostel-1', room_id: 'room-1', guardian_name: 'Suresh Sharma',
    guardian_phone: '+91 98765 43216', address: 'Delhi, India', created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'student-3', user_id: 'user-3', student_id: 'STU2024023', name: 'Priya Verma',
    email: 'priya.verma@college.edu', phone: '+91 98765 43223', department: 'Electronics', year: 2,
    hostel_id: 'hostel-3', room_id: 'room-4', guardian_name: 'Vikram Verma',
    guardian_phone: '+91 98765 43224', address: 'Mumbai, Maharashtra', created_at: '2026-08-02T00:00:00Z',
  },
];

const demoResult = <T,>(data: T, error: string | null = null): StudentResult<T> => ({ data, error, source: 'demo' });
const liveResult = <T,>(data: T, error: string | null = null): StudentResult<T> => ({ data, error, source: 'supabase' });
const errorMessage = (err: unknown, fallback: string) => err instanceof Error ? err.message : fallback;

async function findStudentProfileId(email: string, studentName: string): Promise<{ id: string | null; warning: string | null }> {
  try {
    const { data, error } = await supabase.from('profiles').select('id, full_name')
      .eq('role', 'student').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (error) return { id: null, warning: `Could not verify a matching student sign-in: ${error.message}` };
    if (!data) return { id: null, warning: 'No matching student sign-in is visible. This record remains unlinked; after the student signs up with the matching email and student ID and confirms the email, the database will link it automatically.' };
    if (studentName.trim().toLowerCase().replace(/\s+/g, ' ') !== data.full_name.trim().toLowerCase().replace(/\s+/g, ' ')) {
      return { id: null, warning: 'The student record and sign-in names do not match. Verify the account and student record before linking them.' };
    }
    return { id: data.id, warning: null };
  } catch (err) {
    return { id: null, warning: `Could not verify a matching student sign-in: ${errorMessage(err, 'The profile lookup failed.')}` };
  }
}

function filterDemoStudents(filters?: { hostelId?: string; hostelIds?: string[]; intendedHostelIds?: string[]; roomId?: string; search?: string }) {
  let list = [...mockStudents];
  if (filters?.hostelId) list = list.filter((student) => student.hostel_id === filters.hostelId);
  if (filters?.hostelIds) list = list.filter((student) => filters.hostelIds?.includes(student.hostel_id || '') === true);
  if (filters?.intendedHostelIds) list = list.filter((student) => filters.intendedHostelIds?.includes(student.intended_hostel_id || '') === true);
  if (filters?.roomId) list = list.filter((student) => student.room_id === filters.roomId);
  const search = filters?.search?.trim().toLocaleLowerCase();
  if (search) {
    list = list.filter((student) => [student.name, student.student_id, student.email]
      .some((value) => value.toLocaleLowerCase().includes(search)));
  }
  return list;
}

export async function getStudents(filters?: {
  hostelId?: string;
  hostelIds?: string[];
  intendedHostelIds?: string[];
  roomId?: string;
  search?: string;
}): Promise<StudentResult<Student[] | null>> {
  if (!isSupabaseConfigured) return demoResult(filterDemoStudents(filters));

  try {
    let query = supabase.from('students').select(STUDENT_SELECT);
    if (filters?.hostelId) query = query.eq('hostel_id', filters.hostelId);
    if (filters?.hostelIds) query = query.in('hostel_id', filters.hostelIds);
    if (filters?.intendedHostelIds) query = query.in('intended_hostel_id', filters.intendedHostelIds);
    if (filters?.roomId) query = query.eq('room_id', filters.roomId);
    const search = filters?.search?.trim().replace(/[\\,().]/g, '\\$&');
    if (search) query = query.or(`name.ilike.%${search}%,student_id.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error } = await query.order('name');
    if (error) return liveResult(null, error.message);
    return liveResult((data || []) as Student[]);
  } catch (err) {
    return liveResult(null, errorMessage(err, 'Failed to fetch students from Supabase.'));
  }
}

export async function getStudentById(id: string): Promise<StudentResult<Student | null>> {
  if (!isSupabaseConfigured) {
    return demoResult(mockStudents.find((student) => student.id === id) || null);
  }

  try {
    const { data, error } = await supabase.from('students')
      .select(STUDENT_SELECT).eq('id', id).maybeSingle();
    if (error) return liveResult(null, error.message);
    return liveResult(data as Student | null);
  } catch (err) {
    return liveResult(null, errorMessage(err, 'Failed to fetch student from Supabase.'));
  }
}

export async function getStudentByUserId(userId: string): Promise<StudentResult<Student | null>> {
  if (!isSupabaseConfigured) {
    return demoResult(mockStudents.find((student) => student.user_id === userId) || null);
  }

  try {
    const { data, error } = await supabase.from('students')
      .select(STUDENT_SELECT).eq('user_id', userId).maybeSingle();
    if (error) return liveResult(null, error.message);
    return liveResult(data as Student | null);
  } catch (err) {
    return liveResult(null, errorMessage(err, 'Failed to fetch student record from Supabase.'));
  }
}

export async function createStudent(payload: StudentCreatePayload): Promise<StudentResult<Student | null>> {
  if (!isSupabaseConfigured) {
    const newStudent: Student = {
      ...payload, id: `student-${Date.now()}`, user_id: null,
      created_at: new Date().toISOString(),
    };
    mockStudents.push(newStudent);
    return demoResult(newStudent);
  }

  try {
    const profile = await findStudentProfileId(payload.email, payload.name);
    const insertPayload = profile.id ? { ...payload, user_id: profile.id } : payload;
    const { data, error } = await supabase.from('students').insert([insertPayload])
      .select(STUDENT_SELECT).single();
    if (error) return liveResult(null, error.message);
    return { ...liveResult(data as Student), warning: profile.warning };
  } catch (err) {
    return liveResult(null, errorMessage(err, 'Failed to create student in Supabase.'));
  }
}

export async function updateStudent(id: string, payload: StudentUpdatePayload): Promise<StudentResult<Student | null>> {
  if (!isSupabaseConfigured) {
    const index = mockStudents.findIndex((student) => student.id === id);
    if (index < 0) return demoResult(null, 'Student not found in demo data.');
    mockStudents[index] = { ...mockStudents[index], ...payload };
    return demoResult(mockStudents[index]);
  }

  try {
    const { data: currentStudent, error: lookupError } = await supabase.from('students')
      .select('user_id, name').eq('id', id).maybeSingle();
    if (lookupError) return liveResult(null, lookupError.message);
    if (!currentStudent) return liveResult(null, 'Student record was not found or is not visible to this account.');

    let updatePayload: StudentUpdatePayload & { user_id?: string } = payload;
    let warning: string | null = null;
    if (!currentStudent.user_id && payload.email) {
      const profile = await findStudentProfileId(payload.email || '', payload.name || currentStudent.name);
      warning = profile.warning;
      if (profile.id) updatePayload = { ...payload, user_id: profile.id };
    }

    const { data, error } = await supabase.from('students').update(updatePayload).eq('id', id)
      .select(STUDENT_SELECT).maybeSingle();
    if (error) return liveResult(null, error.message);
    if (!data) return liveResult(null, 'Student was not updated. It may be missing or the database denied access.');
    return { ...liveResult(data as Student), warning };
  } catch (err) {
    return liveResult(null, errorMessage(err, 'Failed to update student in Supabase.'));
  }
}

// Allocation remains a separate operation; callers must treat demo results as non-persistent.
export async function assignRoom(
  studentId: string,
  roomId: string | null,
  hostelId?: string | null
): Promise<StudentResult<Student | null>> {
  if (!isSupabaseConfigured) {
    const index = mockStudents.findIndex((student) => student.id === studentId);
    if (index < 0) return demoResult(null, 'Student not found in demo data.');
    mockStudents[index].room_id = roomId || undefined;
    mockStudents[index].hostel_id = roomId ? hostelId || undefined : undefined;
    return demoResult(mockStudents[index]);
  }

  try {
    const updatePayload = { room_id: roomId, hostel_id: roomId ? hostelId || null : null };
    const { data, error } = await supabase.from('students').update(updatePayload).eq('id', studentId)
      .select(STUDENT_SELECT).maybeSingle();
    if (error) return liveResult(null, error.message);
    if (!data) return liveResult(null, 'Student was not updated. It may be missing or the database denied access.');
    return liveResult(data as Student);
  } catch (err) {
    return liveResult(null, errorMessage(err, 'Failed to assign room in Supabase.'));
  }
}
