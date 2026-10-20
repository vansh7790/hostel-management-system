import { createContext } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Profile, UserRole } from '../types';

export interface AuthContextType {
  user: SupabaseUser | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: UserRole }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    studentId: string
  ) => Promise<{ error: Error | null; needsEmailConfirmation: boolean; role?: UserRole }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  isPasswordRecovery: boolean;
  isConfigured: boolean;
  isDemoMode: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
