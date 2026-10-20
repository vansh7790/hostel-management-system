import { PageHeader } from '../../components/layout';
import { Card, Badge } from '../../components/ui';
import UnlinkedStudentNotice from '../../components/student/UnlinkedStudentNotice';
import { BedDouble } from 'lucide-react';
import { useCurrentStudent } from '../../hooks/useCurrentStudent';

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
      <span className="text-gray-400 block mb-1">{label}</span>
      <span className="font-semibold text-gray-900 text-sm">{value}</span>
      {sub && <span className="text-gray-500 block text-[11px] mt-0.5">{sub}</span>}
    </div>
  );
}

export default function StudentRoom() {
  const { student, loading, error } = useCurrentStudent();
  const room = student?.room;
  const hostel = student?.actual_hostel;

  return (
    <div className="space-y-6">
      <PageHeader title="My Room Allocation" description="Your current hostel and room assignment." />

      {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading your allocation...</p>
      ) : !student ? (
        !error && <UnlinkedStudentNotice />
      ) : !room ? (
        <Card>
          <div className="flex items-start gap-3">
            <BedDouble className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">Room allocation pending</h3>
              <p className="mt-1 text-sm text-gray-600">
                Your student record is registered but no room has been assigned yet. The warden of your intended hostel
                will allocate a room; this page updates once the allocation is saved.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Room Details</h3>
              <p className="text-xs text-gray-500">Live allocation from the hostel database</p>
            </div>
            <Badge variant="success" dot>Active Allocation</Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <Detail label="Hostel" value={hostel ? `${hostel.name} (${hostel.type === 'boys' ? 'Boys' : 'Girls'})` : '—'} sub={hostel?.address || undefined} />
            <Detail label="Room Number" value={room.room_number} sub={`Floor ${room.floor}`} />
            <Detail label="Occupancy" value={`${room.current_occupants} of ${room.capacity} beds filled`} sub={room.capacity === 1 ? 'Single room' : `${room.capacity}-sharing room`} />
            <Detail label="Room Status" value={room.status === 'maintenance' ? 'Under maintenance' : room.status === 'full' ? 'Full' : 'Available beds'} />
          </div>
          <p className="mt-5 text-xs text-gray-500">For room issues, raise a complaint from the Complaints page; room transfers are handled by the warden or administrator.</p>
        </Card>
      )}
    </div>
  );
}
