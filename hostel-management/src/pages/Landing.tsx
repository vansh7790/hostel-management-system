import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Shield,
  Users,
  MessageSquare,
  Calendar,
  Bell,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react';
import Button from '../components/ui/Button';

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Building2,
      title: 'Room Management',
      description: 'Efficiently manage hostel rooms, allocations, and occupancy tracking.',
    },
    {
      icon: MessageSquare,
      title: 'Complaint System',
      description: 'Submit and track maintenance complaints with real-time status updates.',
    },
    {
      icon: Calendar,
      title: 'Leave Management',
      description: 'Apply for leave passes and get quick approvals from wardens.',
    },
    {
      icon: Bell,
      title: 'Notice Board',
      description: 'Stay updated with important hostel announcements and notices.',
    },
    {
      icon: Shield,
      title: 'Secure Access',
      description: 'Role-based access for students, wardens, and administrators.',
    },
    {
      icon: Users,
      title: 'Student Directory',
      description: 'View roommates, hostel mates, and contact information easily.',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Sign In',
      description: 'Log in with your credentials based on your role.',
    },
    {
      step: '02',
      title: 'Access Dashboard',
      description: 'View your personalized dashboard with relevant information.',
    },
    {
      step: '03',
      title: 'Manage Activities',
      description: 'Submit complaints, apply for leave, view notices, and more.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">HostelHub</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <GraduationCap className="h-4 w-4" />
            Built for College Hostels
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Smart Hostel Management
            <br />
            <span className="text-primary-600">Made Simple</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
            A centralized platform for students, wardens, and administrators to manage
            hostel activities efficiently. From room allocations to complaint tracking —
            everything in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/login')}
              rightIcon={<ArrowRight className="h-5 w-5" />}
            >
              Access Portal
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Explore Features
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mt-20 max-w-3xl mx-auto">
            {[
              { value: '500+', label: 'Students' },
              { value: '6', label: 'Hostels' },
              { value: '200+', label: 'Rooms' },
              { value: '24/7', label: 'Support' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Comprehensive tools to manage every aspect of hostel life efficiently.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Get started in three simple steps.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step) => (
              <div key={step.step} className="text-center">
                <div className="w-14 h-14 bg-primary-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-gray-50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Why Choose HostelHub?
              </h2>
              <div className="space-y-4">
                {[
                  'Centralized management for all hostel activities',
                  'Real-time complaint tracking and resolution',
                  'Quick leave approval process',
                  'Instant hostel notices and announcements',
                  'Role-based secure access control',
                  'Easy room allocation and management',
                ].map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center border border-primary-100">
                    <GraduationCap className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">For Students</p>
                    <p className="text-xs text-gray-500">View room details, submit complaints, track digital gate passes</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center border border-primary-100">
                    <Shield className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">For Wardens</p>
                    <p className="text-xs text-gray-500">Monitor resident occupancy, review complaints, approve gate passes</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center border border-primary-100">
                    <Building2 className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">For Administrators</p>
                    <p className="text-xs text-gray-500">Multi-hostel management, room allocation matrix, and fee records</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8">
            Access the hostel management portal and streamline your hostel experience.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/login')}
            rightIcon={<ArrowRight className="h-5 w-5" />}
          >
            Go to Login
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center">
              <Building2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">HostelHub</span>
          </div>
          <p className="text-sm text-gray-500">
            &copy; 2026 HostelHub. College Hostel Management System.
          </p>
        </div>
      </footer>
    </div>
  );
}
