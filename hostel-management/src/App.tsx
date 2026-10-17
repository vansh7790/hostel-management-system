import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { DashboardLayout } from './components/layout';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentProfile from './pages/student/Profile';
import StudentRoom from './pages/student/Room';
import StudentComplaints from './pages/student/Complaints';
import StudentLeave from './pages/student/Leave';
import StudentFees from './pages/student/Fees';
import StudentNotices from './pages/student/Notices';

// Warden Pages
import WardenDashboard from './pages/warden/Dashboard';
import WardenStudents from './pages/warden/Students';
import WardenRooms from './pages/warden/Rooms';
import WardenComplaints from './pages/warden/Complaints';
import WardenLeave from './pages/warden/Leave';
import WardenNotices from './pages/warden/Notices';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminHostels from './pages/admin/Hostels';
import AdminRooms from './pages/admin/Rooms';
import AdminAllocations from './pages/admin/Allocations';
import AdminComplaints from './pages/admin/Complaints';
import AdminLeave from './pages/admin/Leave';
import AdminFees from './pages/admin/Fees';
import AdminNotices from './pages/admin/Notices';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Student Protected Routes */}
          <Route
            element={
              <ProtectedRoute allowedRole="student">
                <DashboardLayout role="student" />
              </ProtectedRoute>
            }
          >
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/room" element={<StudentRoom />} />
            <Route path="/student/complaints" element={<StudentComplaints />} />
            <Route path="/student/leave" element={<StudentLeave />} />
            <Route path="/student/fees" element={<StudentFees />} />
            <Route path="/student/notices" element={<StudentNotices />} />
          </Route>

          {/* Warden Protected Routes */}
          <Route
            element={
              <ProtectedRoute allowedRole="warden">
                <DashboardLayout role="warden" />
              </ProtectedRoute>
            }
          >
            <Route path="/warden" element={<WardenDashboard />} />
            <Route path="/warden/students" element={<WardenStudents />} />
            <Route path="/warden/rooms" element={<WardenRooms />} />
            <Route path="/warden/complaints" element={<WardenComplaints />} />
            <Route path="/warden/leave" element={<WardenLeave />} />
            <Route path="/warden/notices" element={<WardenNotices />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route
            element={
              <ProtectedRoute allowedRole="admin">
                <DashboardLayout role="admin" />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/hostels" element={<AdminHostels />} />
            <Route path="/admin/rooms" element={<AdminRooms />} />
            <Route path="/admin/allocations" element={<AdminAllocations />} />
            <Route path="/admin/complaints" element={<AdminComplaints />} />
            <Route path="/admin/leave" element={<AdminLeave />} />
            <Route path="/admin/fees" element={<AdminFees />} />
            <Route path="/admin/notices" element={<AdminNotices />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
