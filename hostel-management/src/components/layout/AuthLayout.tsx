import { Building2, CheckCircle2 } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Product Identity */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-700 relative overflow-hidden flex-col justify-between p-12 lg:p-16 text-white">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-radial from-primary-600/60 to-primary-900 pointer-events-none" />

        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 backdrop-blur-xs rounded-xl flex items-center justify-center border border-white/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">HostelHub</h1>
            <p className="text-xs text-primary-200">Campus Residence Portal</p>
          </div>
        </div>

        {/* Value proposition */}
        <div className="relative z-10 max-w-lg my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-primary-100 text-xs font-medium mb-6 backdrop-blur-xs border border-white/10">
            <span>Official College Hostel Management System</span>
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight mb-4">
            One place for everything hostel.
          </h2>
          <p className="text-primary-100 text-base leading-relaxed mb-8">
            Manage rooms, complaints, leave passes, and hostel updates through a single unified portal designed for modern campus living.
          </p>

          <div className="space-y-3.5">
            {[
              'Room & hostel accommodation details',
              'Complaints & rapid maintenance tracking',
              'Digital gate passes & fee tracking',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm text-primary-100">
                <CheckCircle2 className="h-4.5 w-4.5 text-primary-300 flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-primary-200/80 border-t border-white/10 pt-4 flex justify-between items-center">
          <span>College Software Engineering Project</span>
          <span>Academic Year 2026</span>
        </div>
      </div>

      {/* Right side - Form Container */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">HostelHub</h1>
              <p className="text-xs text-gray-500 mt-0.5">Campus Residence Portal</p>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
