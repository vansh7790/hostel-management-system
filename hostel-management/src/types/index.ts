// User roles
export type UserRole = 'student' | 'warden' | 'admin';

// User type
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

// Profile in Supabase public.profiles
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

// Hostel
export interface Hostel {
  id: string;
  name: string;
  type: 'boys' | 'girls';
  warden_id?: string | null;
  total_rooms: number;
  address?: string;
  created_at: string;
}

// Room
export interface Room {
  id: string;
  room_number: string;
  hostel_id: string;
  hostel?: Hostel;
  floor: number;
  capacity: number;
  current_occupants: number;
  status: 'available' | 'full' | 'maintenance';
}

// Student
export interface Student {
  id: string;
  user_id: string | null;
  student_id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  year?: number;
  intended_hostel_id?: string | null;
  intended_hostel?: Hostel | null;
  hostel_id?: string;
  actual_hostel?: Hostel | null;
  room_id?: string;
  room?: Room;
  guardian_name?: string;
  guardian_phone?: string;
  address?: string;
  created_at: string;
}

// Complaint
export type ComplaintCategory = 'electrical' | 'plumbing' | 'cleaning' | 'internet' | 'furniture' | 'other';
export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved';

export interface Complaint {
  id: string;
  student_id: string;
  student?: Student;
  title: string;
  category: ComplaintCategory;
  description: string;
  room_id?: string;
  room?: Room;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
}

// Leave Request
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  student_id: string;
  student?: Student;
  reason: string;
  destination: string;
  start_date: string;
  end_date: string;
  emergency_contact: string;
  message?: string;
  status: LeaveStatus;
  remark?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

// Notice
export type NoticePriority = 'low' | 'medium' | 'high';

export interface Notice {
  id: string;
  title: string;
  description: string;
  priority: NoticePriority;
  posted_by: string;
  poster_name?: string;
  hostel_id?: string;
  created_at: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalStudents: number;
  totalHostels: number;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  pendingComplaints: number;
  pendingLeaveRequests: number;
}
