import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../ui';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  allowedRole?: UserRole;
  children: React.ReactNode;
}

export default function ProtectedRoute({ allowedRole, children }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Verifying authentication session..." />
      </div>
    );
  }

  // If not logged in, redirect to login with return path
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a specific role is required and user does not have that role, redirect to their role's dashboard
  if (allowedRole && role && role !== allowedRole) {
    const roleHomeMap: Record<UserRole, string> = {
      student: '/student',
      warden: '/warden',
      admin: '/admin',
    };
    return <Navigate to={roleHomeMap[role]} replace />;
  }

  return <>{children}</>;
}
