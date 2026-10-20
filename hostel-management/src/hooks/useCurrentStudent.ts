import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context';
import { getStudentByUserId } from '../services';
import type { Student } from '../types';

/**
 * Loads the student record linked to the signed-in account. `student` is null
 * (with no error) when the account is not linked to a record yet.
 */
export function useCurrentStudent() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!user) return;
    getStudentByUserId(user.id).then((result) => {
      if (!active) return;
      setStudent(result.data);
      setError(result.error ? `Could not load your student record: ${result.error}` : null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user, refreshKey]);

  const reload = useCallback(() => setRefreshKey((key) => key + 1), []);
  return { student, loading, error, reload };
}
