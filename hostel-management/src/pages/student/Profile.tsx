import { PageHeader } from '../../components/layout';
import { Card, Badge, Button } from '../../components/ui';
import { Phone, Mail, GraduationCap, MapPin } from 'lucide-react';

export default function StudentProfile() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Profile"
        description="Official student residential record and guardian emergency contact details."
        action={
          <Button size="sm" variant="outline">
            Request Data Update
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="text-center p-6">
          <div className="w-20 h-20 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold border-2 border-primary-200">
            AS
          </div>
          <h3 className="text-base font-bold text-gray-900">Aarav Sharma</h3>
          <p className="text-xs text-gray-500">Roll No: 2024CS018</p>
          <div className="mt-2 flex justify-center gap-1.5">
            <Badge variant="success" dot>Resident Active</Badge>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 text-left text-xs space-y-2.5 text-gray-600">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-gray-400" />
              <span>B.Tech Computer Science (3rd Year)</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>aarav.sharma@college.edu</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>+91 98765 01234</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span>Hostel Mandakini · Room B-204</span>
            </div>
          </div>
        </Card>

        {/* Detailed Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              Academic & Hostelite Information
            </h4>
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block">Enrollment ID</span>
                <span className="font-semibold text-gray-800 text-sm">EN20249821</span>
              </div>
              <div>
                <span className="text-gray-400 block">Department</span>
                <span className="font-semibold text-gray-800 text-sm">Computer Science & Engineering</span>
              </div>
              <div>
                <span className="text-gray-400 block">Current Semester</span>
                <span className="font-semibold text-gray-800 text-sm">Semester 5 (Fall 2026)</span>
              </div>
              <div>
                <span className="text-gray-400 block">Hostel Admission Date</span>
                <span className="font-semibold text-gray-800 text-sm">August 1, 2024</span>
              </div>
            </div>
          </Card>

          <Card>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
              Parent & Emergency Contact
            </h4>
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block">Guardian Name</span>
                <span className="font-semibold text-gray-800 text-sm">Rajesh Sharma</span>
              </div>
              <div>
                <span className="text-gray-400 block">Relationship</span>
                <span className="font-semibold text-gray-800 text-sm">Father</span>
              </div>
              <div>
                <span className="text-gray-400 block">Emergency Phone</span>
                <span className="font-semibold text-gray-800 text-sm">+91 98765 88990</span>
              </div>
              <div>
                <span className="text-gray-400 block">Permanent Residence</span>
                <span className="font-semibold text-gray-800 text-sm">Jaipur, Rajasthan, India</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
