import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserRole } from '../types';

interface AuthContextType {
  user: SupabaseUser | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: UserRole }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local fallback demo profiles for development/demonstration
const DEMO_PROFILES: Record<string, { full_name: string; role: UserRole }> = {
  'student@hostelhub.com': { full_name: 'Aarav Sharma', role: 'student' },
  'warden@hostelhub.com': { full_name: 'Dr. Singh', role: 'warden' },
  'admin@hostelhub.com': { full_name: 'Admin User', role: 'admin' },
};

const LOCAL_STORAGE_KEY = 'hostelhub_demo_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch user's profile from Supabase
  const fetchProfile = async (userId: string, email: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // If profile row doesn't exist, check user metadata or demo mapping
        const matched = DEMO_PROFILES[email.toLowerCase()];
        const fallbackRole = (matched?.role || 'student') as UserRole;
        const fallbackName = matched?.full_name || email.split('@')[0];

        const newProfile: Profile = {
          id: userId,
          email,
          full_name: fallbackName,
          role: fallbackRole,
        };

        // Try inserting into profiles table
        await supabase.from('profiles').insert([newProfile]).select().single();
        return newProfile;
      }

      return data as Profile;
    } catch {
      const matched = DEMO_PROFILES[email.toLowerCase()];
      return {
        id: userId,
        email,
        full_name: matched?.full_name || email.split('@')[0],
        role: matched?.role || 'student',
      };
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            setUser(session.user);
            const userProfile = await fetchProfile(session.user.id, session.user.email || '');
            if (isMounted) setProfile(userProfile);
          }
        } catch (err) {
          console.warn('Error fetching Supabase session:', err);
        }
      } else {
        // Fallback demo session from localStorage for seamless local testing
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

    // Listen to real Supabase auth state change
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          const userProfile = await fetchProfile(session.user.id, session.user.email || '');
          if (isMounted) {
            setProfile(userProfile);
            setLoading(false);
          }
        } else if (isSupabaseConfigured) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setLoading(false);
          return { error: new Error(error.message) };
        }

        if (data.user) {
          setUser(data.user);
          const userProfile = await fetchProfile(data.user.id, data.user.email || cleanEmail);
          setProfile(userProfile);
          setLoading(false);
          return { error: null, role: userProfile?.role || 'student' };
        }
      } else {
        // Demo mode without live Supabase credentials configured
        // Validate against known demo credentials or provide demo access
        const matched = DEMO_PROFILES[cleanEmail];
        const role: UserRole = matched?.role || (cleanEmail.includes('warden') ? 'warden' : cleanEmail.includes('admin') ? 'admin' : 'student');
        const fullName = matched?.full_name || (role === 'warden' ? 'Dr. Singh' : role === 'admin' ? 'Admin User' : 'Aarav Sharma');

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

      setLoading(false);
      return { error: new Error('Unable to complete sign in. Please verify credentials.') };
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
      return { error: new Error(message) };
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
        signOut,
        isConfigured: isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
