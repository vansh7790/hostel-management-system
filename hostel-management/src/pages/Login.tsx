import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Shield, Users, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/layout';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context';

interface DemoRole {
  role: 'student' | 'warden' | 'admin';
  label: string;
  badge: string;
  icon: React.ReactNode;
  email: string;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, loading: authLoading, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'student' | 'warden' | 'admin' | null>(null);

  // Retrieve default demo credentials from environment or sensible project defaults
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || 'demo123';

  const demoRoles: DemoRole[] = [
    {
      role: 'student',
      label: 'Student',
      badge: 'Room A-204',
      icon: <GraduationCap className="h-4.5 w-4.5 text-primary-600" />,
      email: import.meta.env.VITE_DEMO_STUDENT_EMAIL || 'student@hostelhub.com',
    },
    {
      role: 'warden',
      label: 'Warden',
      badge: 'Hostel A',
      icon: <Shield className="h-4.5 w-4.5 text-primary-600" />,
      email: import.meta.env.VITE_DEMO_WARDEN_EMAIL || 'warden@hostelhub.com',
    },
    {
      role: 'admin',
      label: 'Admin',
      badge: 'Central Office',
      icon: <Users className="h-4.5 w-4.5 text-primary-600" />,
      email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'admin@hostelhub.com',
    },
  ];

  const handleAuthSuccess = (role: 'student' | 'warden' | 'admin') => {
    // If user was trying to access a specific page before login, check if authorized
    const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
    if (fromPath && fromPath.startsWith(`/${role}`)) {
      navigate(fromPath, { replace: true });
    } else {
      navigate(`/${role}`, { replace: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error, role } = await signIn(email, password);

    if (error) {
      setErrorMessage(
        error.message.includes('Invalid login credentials')
          ? 'Incorrect email or password. Please verify your credentials.'
          : error.message
      );
      setIsSubmitting(false);
      return;
    }

    if (role) {
      handleAuthSuccess(role);
    }
    setIsSubmitting(false);
  };

  const handleDemoSelect = async (demo: DemoRole) => {
    setSelectedRole(demo.role);
    setEmail(demo.email);
    setPassword(demoPassword);
    setErrorMessage(null);
    setIsSubmitting(true);

    const { error, role } = await signIn(demo.email, demoPassword);

    if (error) {
      setErrorMessage(
        error.message.includes('Invalid login credentials')
          ? `Demo account (${demo.email}) not found in Supabase Auth. Please ensure demo users are seeded or use local mock.`
          : error.message
      );
      setIsSubmitting(false);
      return;
    }

    if (role) {
      handleAuthSuccess(role);
    }
    setIsSubmitting(false);
  };

  return (
    <AuthLayout>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Sign in to your portal</h2>
          <p className="text-sm text-gray-500 mt-1">
            Access your hostel dashboard and services
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Sign in with your assigned account. Your database-assigned role determines which portal opens.
          </p>
          <div className="mt-2.5">
            {isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Supabase Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200" title="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to connect live backend">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Offline Demo Mode (Local Storage)
              </span>
            )}
          </div>
        </div>

        {/* Demo Role Quick Cards are available only in explicit offline mode. */}
        {!isConfigured && <div className="mb-6 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200/80">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Quick Demo Access
            </span>
            <span className="text-[11px] text-primary-600 font-medium">1-Click Sign In</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {demoRoles.map((demo) => {
              const isSelected = selectedRole === demo.role;
              return (
                <button
                  key={demo.role}
                  type="button"
                  disabled={isSubmitting || authLoading}
                  onClick={() => handleDemoSelect(demo)}
                  className={`flex flex-col items-center text-center p-2.5 rounded-lg border transition-all duration-150 cursor-pointer text-left
                    ${
                      isSelected
                        ? 'border-primary-600 bg-white ring-2 ring-primary-500/20 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mb-1.5">
                    {demo.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-900 leading-tight">
                    {demo.label}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 truncate w-full">
                    {demo.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>}

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gray-50 sm:bg-white px-3 text-gray-400">or sign in with credentials</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="College Email ID"
            type="email"
            placeholder="e.g. student@hostelhub.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting || authLoading}
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Password</label>
              <span className="text-xs text-primary-600 hover:underline cursor-pointer">
                Forgot password?
              </span>
            </div>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting || authLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            size="md"
            isLoading={isSubmitting || authLoading}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Sign In to HostelHub
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            New here?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
              Create a student account
            </Link>
          </p>
          {!isConfigured && (
            <p className="text-xs text-gray-400 mt-2">
              Offline demo mode is active because Supabase is not configured.
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
