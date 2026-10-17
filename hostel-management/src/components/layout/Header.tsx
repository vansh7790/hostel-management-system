import { Menu, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface HeaderProps {
  role: UserRole;
  userName: string;
  onMenuClick: () => void;
}

export default function Header({ role, userName, onMenuClick }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { signOut } = useAuth();

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  const rolePills: Record<UserRole, { label: string; style: string }> = {
    student: {
      label: 'Student',
      style: 'bg-blue-50 text-blue-700 border-blue-200/80',
    },
    warden: {
      label: 'Hostel Warden',
      style: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    },
    admin: {
      label: 'Administrator',
      style: 'bg-purple-50 text-purple-700 border-purple-200/80',
    },
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-gray-200/80">
      <div className="flex items-center justify-between h-15 px-4 sm:px-6">
        {/* Left section */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 lg:hidden cursor-pointer"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${rolePills[role].style}`}
          >
            {rolePills[role].label}
          </span>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications */}
          <button
            className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-600 rounded-full ring-2 ring-white" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block" />

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center text-xs font-semibold">
                {userName.charAt(0)}
              </div>
              <span className="text-xs font-medium text-gray-700 hidden sm:block">
                {userName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
            </button>

            {/* Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-900 truncate">{userName}</p>
                  <p className="text-[11px] text-gray-500 capitalize">{role}</p>
                </div>
                {role === 'student' && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/student/profile');
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    My Profile
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
