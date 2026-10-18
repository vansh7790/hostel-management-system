import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context';
import type { UserRole } from '../../types';

interface DashboardLayoutProps {
  role?: UserRole;
  userName?: string;
}

export default function DashboardLayout({
  role: propRole,
  userName: propUserName,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, role: authRole, user } = useAuth();

  // Use real authenticated role, falling back to route prop
  const activeRole: UserRole = authRole || propRole || 'student';

  // Use real authenticated profile name, falling back to metadata or prop
  const activeUserName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    propUserName ||
    (activeRole === 'warden' ? 'Dr. Singh' : activeRole === 'admin' ? 'Admin User' : 'Aarav Sharma');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        role={activeRole}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          role={activeRole}
          userName={activeUserName}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
