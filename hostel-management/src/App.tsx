import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { DashboardLayout } from './components/layout';
import { LoadingSpinner } from './components/ui';

// Pages: Landing and Login load eagerly for first paint; the rest load on demand.
import Landing from './pages/Landing';
import Login from './pages/Login';
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Student Pages
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentProfile = lazy(() => import('./pages/student/Profile'));
const StudentRoom = lazy(() => import('./pages/student/Room'));
const StudentComplaints = lazy(() => import('./pages/student/Complaints'));
const StudentLeave = lazy(() => import('./pages/student/Leave'));
const StudentNotices = lazy(() => import('./pages/student/Notices'));

// Warden Pages
const WardenDashboard = lazy(() => import('./pages/warden/Dashboard'));
const WardenStudents = lazy(() => import('./pages/warden/Students'));
const WardenRooms = lazy(() => import('./pages/warden/Rooms'));
const WardenComplaints = lazy(() => import('./pages/warden/Complaints'));
const WardenLeave = lazy(() => import('./pages/warden/Leave'));
const WardenNotices = lazy(() => import('./pages/warden/Notices'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminStudents = lazy(() => import('./pages/admin/Students'));
const AdminHostels = lazy(() => import('./pages/admin/Hostels'));
const AdminRooms = lazy(() => import('./pages/admin/Rooms'));
const AdminAllocations = lazy(() => import('./pages/admin/Allocations'));
const AdminComplaints = lazy(() => import('./pages/admin/Complaints'));
const AdminLeave = lazy(() => import('./pages/admin/Leave'));
const AdminNotices = lazy(() => import('./pages/admin/Notices'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <LoadingSpinner size="lg" message="Loading page..." />
            </div>
          }
        >
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

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
            <Route path="/admin/notices" element={<AdminNotices />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
