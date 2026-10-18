import React, { useEffect, useState } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserRole } from '../types';
import { AuthContext } from './authContextDef';

// Local demo profiles used ONLY when Supabase credentials are not configured in .env
const DEMO_PROFILES: Record<string, { full_name: string; role: UserRole }> = {
  'student@hostelhub.com': { full_name: 'Aarav Sharma', role: 'student' },
  'warden@hostelhub.com': { full_name: 'Dr. Singh', role: 'warden' },
  'admin@hostelhub.com': { full_name: 'Admin User', role: 'admin' },
};

const LOCAL_STORAGE_KEY = 'hostelhub_demo_session';

const isUserRole = (value: unknown): value is UserRole =>
  value === 'student' || value === 'warden' || value === 'admin';

const toProfile = (value: unknown): Profile | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<Profile>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.full_name !== 'string' ||
    typeof candidate.email !== 'string' ||
    !isUserRole(candidate.role)
  ) {
    return null;
  }

  return candidate as Profile;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch user's profile from live Supabase public.profiles table
  const fetchSupabaseProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to retrieve user profile:', error.message);
        return null;
      }

      return toProfile(data);
    } catch (err) {
      console.error('Exception fetching profile:', err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        // STRICT REAL AUTHENTICATION: Never load demo session from localStorage
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error fetching Supabase session:', error.message);
          } else if (session?.user && isMounted) {
            const userProfile = await fetchSupabaseProfile(session.user.id);
            if (isMounted && userProfile) {
              setUser(session.user);
              setProfile(userProfile);
            } else if (isMounted) {
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
            }
          }
        } catch (err) {
          console.error('Exception initializing Supabase auth:', err);
        }
      } else {
        // EXPLICIT OFFLINE DEMO MODE: Only used when VITE_SUPABASE_URL is missing/placeholder
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved && isMounted) {
          try {
            const parsed = JSON.parse(saved);
            setUser({
              id: parsed.id,
              email: parsed.email,
              app_metadata: {},
              user_metadata: { full_name: parsed.full_name, role: parsed.role },
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            } as SupabaseUser);
            setProfile(parsed);
          } catch {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      }

      if (isMounted) setLoading(false);
    }

    initAuth();

    // Listen to live Supabase auth state changes only if configured
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange(
        async (_event: string, session: Session | null) => {
          if (!isMounted) return;

          if (session?.user) {
            const userProfile = await fetchSupabaseProfile(session.user.id);
            if (isMounted) {
              if (userProfile) {
                setUser(session.user);
                setProfile(userProfile);
              } else {
                setUser(null);
                setProfile(null);
                void supabase.auth.signOut().catch((signOutError) => {
                  console.warn('Unable to clear the invalid Supabase session:', signOutError);
                });
              }
              setLoading(false);
            }
          } else {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        }
      );
      authListener = data;
    }

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null; role?: UserRole }> => {
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isSupabaseConfigured) {
        // REAL SUPABASE AUTHENTICATION
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setLoading(false);
          return { error: new Error(error.message) };
        }

        if (!data.user) {
          setLoading(false);
          return { error: new Error('Authentication succeeded but user identity was not returned.') };
        }

        const userProfile = await fetchSupabaseProfile(data.user.id);

        if (!userProfile) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setLoading(false);
          return {
            error: new Error(
              'Account authenticated, but no profile record was found in public.profiles. Please run the schema trigger or create the profile.'
            ),
          };
        }

        setUser(data.user);
        setProfile(userProfile);
        setLoading(false);
        return { error: null, role: userProfile.role };
      } else {
        // EXPLICIT OFFLINE DEMO MODE
        const matched = DEMO_PROFILES[cleanEmail];
        const role: UserRole =
          matched?.role ||
          (cleanEmail.includes('warden') ? 'warden' : cleanEmail.includes('admin') ? 'admin' : 'student');
        const fullName =
          matched?.full_name ||
          (role === 'warden' ? 'Dr. Singh' : role === 'admin' ? 'Admin User' : 'Aarav Sharma');

        const demoProfile: Profile = {
          id: `demo-${role}-id`,
          email: cleanEmail,
          full_name: fullName,
          role,
          created_at: new Date().toISOString(),
        };

        const mockUser = {
          id: demoProfile.id,
          email: cleanEmail,
          app_metadata: {},
          user_metadata: { full_name: fullName, role },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as SupabaseUser;

        setUser(mockUser);
        setProfile(demoProfile);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(demoProfile));

        setLoading(false);
        return { error: null, role };
      }
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
      return { error: new Error(message) };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: Error | null; needsEmailConfirmation: boolean; role?: UserRole }> => {
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanFullName = fullName.trim();

      if (!isSupabaseConfigured) {
        setLoading(false);
        return {
          error: new Error('Registration requires a configured Supabase connection.'),
          needsEmailConfirmation: false,
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: cleanFullName },
        },
      });

      if (error) {
        setLoading(false);
        return { error: new Error(error.message), needsEmailConfirmation: false };
      }

      if (!data.user) {
        setLoading(false);
        return {
          error: new Error('Registration did not return a user identity.'),
          needsEmailConfirmation: false,
        };
      }

      if (!data.session) {
        setLoading(false);
        return { error: null, needsEmailConfirmation: true };
      }

      const userProfile = await fetchSupabaseProfile(data.user.id);
      if (!userProfile) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return {
          error: new Error('Your account was created, but its student profile is not available yet.'),
          needsEmailConfirmation: false,
        };
      }

      setUser(data.user);
      setProfile(userProfile);
      setLoading(false);
      return { error: null, needsEmailConfirmation: false, role: userProfile.role };
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during registration.';
      return { error: new Error(message), needsEmailConfirmation: false };
    }
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Error signing out of Supabase:', err);
    } finally {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        loading,
        signIn,
        signUp,
        signOut,
        isConfigured: isSupabaseConfigured,
        isDemoMode: !isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
