import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/layout';
import { Badge, Card } from '../../components/ui';
import { useAuth } from '../../context';
import { getHostels, getRooms } from '../../services';
import type { Room } from '../../types';

type RoomWithHostelName = Room & { hostelName: string };

export default function WardenRooms() {
  const { user, isConfigured } = useAuth();
  const [rooms, setRooms] = useState<RoomWithHostelName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadRooms = async () => {
      setLoading(true);
      setError(null);

      if (!isConfigured) {
        setRooms([]);
        setError('Supabase is not configured. Live room records are unavailable.');
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setRooms([]);
        setError('Your signed-in account could not be identified. Please sign in again.');
        setLoading(false);
        return;
      }

      const hostelsResult = await getHostels({ wardenId: user.id });
      if (hostelsResult.error) {
        if (active) {
          setRooms([]);
          setError(`Could not load your assigned hostels: ${hostelsResult.error}`);
          setLoading(false);
        }
        return;
      }

      const hostels = hostelsResult.data || [];
      const roomResults = await Promise.all(hostels.map(async (hostel) => ({
        hostel,
        result: await getRooms(hostel.id),
      })));

      if (!active) return;

      const roomErrors = roomResults
        .filter(({ result }) => result.error)
        .map(({ hostel, result }) => `${hostel.name}: ${result.error}`);
      if (roomErrors.length) {
        setRooms([]);
        setError(`Could not load room records. ${roomErrors.join(' ')}`);
      } else {
        setRooms(roomResults.flatMap(({ hostel, result }) =>
          (result.data || []).map((room) => ({
            ...room,
            hostelName: room.hostel?.name || hostel.name,
          }))
        ));
      }
      setLoading(false);
    };

    void loadRooms();
    return () => { active = false; };
  }, [isConfigured, user?.id]);

  return (
    <div>
      <PageHeader title="Rooms" description="View room occupancy details." />
      {loading ? (
        <Card><p role="status" className="text-sm text-gray-500">Loading rooms...</p></Card>
      ) : error ? (
        <Card><p role="alert" className="text-sm text-rose-700">{error}</p></Card>
      ) : rooms.length === 0 ? (
        <Card><p role="status" className="text-sm text-gray-500">No rooms are available in your assigned hostel.</p></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const badgeVariant = room.status === 'full' ? 'danger' : room.status === 'maintenance' ? 'warning' : 'success';
            const statusLabel = room.status === 'full' ? 'Full' : room.status === 'maintenance' ? 'Maintenance' : 'Available';
            const occupancy = room.capacity > 0 ? Math.min((room.current_occupants / room.capacity) * 100, 100) : 0;

            return (
              <Card key={room.id} hover>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">{room.room_number}</h3>
                  <Badge variant={badgeVariant} dot>{statusLabel}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Hostel</span><span className="font-medium">{room.hostelName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Floor</span><span className="font-medium">{room.floor}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Occupancy</span><span className="font-medium">{room.current_occupants}/{room.capacity}</span></div>
                </div>
                <div className="mt-3 bg-gray-100 rounded-full h-2"><div className="bg-primary-600 h-2 rounded-full" style={{ width: `${occupancy}%` }} /></div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
