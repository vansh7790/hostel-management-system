import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  User,
  BedDouble,
  MessageSquare,
  Calendar,
  DollarSign,
  Bell,
  Building2,
  Users,
  LayoutGrid,
  ClipboardList,
  ChevronLeft,
  GraduationCap,
} from 'lucide-react';
import type { UserRole } from '../../types';

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  groupTitle?: string;
  items: NavItem[];
}

const getNavGroups = (role: UserRole): NavGroup[] => {
  switch (role) {
    case 'student':
      return [
        {
          groupTitle: 'Overview',
          items: [
            { label: 'Dashboard', path: '/student', icon: <Home className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'My Accommodation',
          items: [
            { label: 'My Room', path: '/student/room', icon: <BedDouble className="h-4 w-4" /> },
            { label: 'Profile', path: '/student/profile', icon: <User className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'Requests & Support',
          items: [
            { label: 'Complaints', path: '/student/complaints', icon: <MessageSquare className="h-4 w-4" /> },
            { label: 'Leave / Gate Pass', path: '/student/leave', icon: <Calendar className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'Hostel Info',
          items: [
            { label: 'Fee Records', path: '/student/fees', icon: <DollarSign className="h-4 w-4" /> },
            { label: 'Notice Board', path: '/student/notices', icon: <Bell className="h-4 w-4" /> },
          ],
        },
      ];
    case 'warden':
      return [
        {
          groupTitle: 'Overview',
          items: [
            { label: 'Dashboard', path: '/warden', icon: <Home className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'Hostel Residents',
          items: [
            { label: 'Students', path: '/warden/students', icon: <Users className="h-4 w-4" /> },
            { label: 'Room Occupancy', path: '/warden/rooms', icon: <BedDouble className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'Operations',
          items: [
            { label: 'Complaints', path: '/warden/complaints', icon: <MessageSquare className="h-4 w-4" /> },
            { label: 'Leave Requests', path: '/warden/leave', icon: <Calendar className="h-4 w-4" /> },
            { label: 'Publish Notices', path: '/warden/notices', icon: <Bell className="h-4 w-4" /> },
          ],
        },
      ];
    case 'admin':
      return [
        {
          groupTitle: 'Overview',
          items: [
            { label: 'Dashboard', path: '/admin', icon: <Home className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'Infrastructure',
          items: [
            { label: 'Hostel Buildings', path: '/admin/hostels', icon: <Building2 className="h-4 w-4" /> },
            { label: 'Rooms Directory', path: '/admin/rooms', icon: <BedDouble className="h-4 w-4" /> },
            { label: 'Allocations', path: '/admin/allocations', icon: <LayoutGrid className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'Directory',
          items: [
            { label: 'All Students', path: '/admin/students', icon: <GraduationCap className="h-4 w-4" /> },
          ],
        },
        {
          groupTitle: 'Management',
          items: [
            { label: 'All Complaints', path: '/admin/complaints', icon: <MessageSquare className="h-4 w-4" /> },
            { label: 'Leave Requests', path: '/admin/leave', icon: <Calendar className="h-4 w-4" /> },
            { label: 'Fee Management', path: '/admin/fees', icon: <DollarSign className="h-4 w-4" /> },
            { label: 'Announcements', path: '/admin/notices', icon: <ClipboardList className="h-4 w-4" /> },
          ],
        },
      ];
  }
};

export default function Sidebar({ role, isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const navGroups = getNavGroups(role);

  const roleLabels = {
    student: 'Student Portal',
    warden: 'Warden Desk',
    admin: 'Admin Console',
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200/80 transition-transform duration-200 ease-in-out
          w-60 flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between h-15 px-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white shadow-xs">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900 tracking-tight">HostelHub</span>
              </div>
              <p className="text-[11px] font-medium text-gray-400">{roleLabels[role]}</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded-md text-gray-400 hover:bg-gray-100 lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {navGroups.map((group, groupIdx) => (
            <div key={group.groupTitle || groupIdx} className="space-y-1">
              {group.groupTitle && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {group.groupTitle}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (window.innerWidth < 1024) onToggle();
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                      ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-xs'
                          : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                      }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-gray-400'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>HostelHub Campus</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
