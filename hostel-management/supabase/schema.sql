-- ==============================================================================
-- HOSTELHUB - SUPABASE AUTHENTICATION & PROFILES SCHEMA
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'warden', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow authenticated users to view profiles (needed to read their own role & see staff/student names)
CREATE POLICY "Allow authenticated read to profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Allow users to update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Allow users to insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 4. Trigger to automatically create a profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. SEED DEMO USERS (Optional - or create via Supabase Auth UI)
-- You can either invite these users via Supabase Dashboard -> Authentication -> Users,
-- or run the helper block below to insert them with password 'demo123'.
-- ==============================================================================

-- Note: In Supabase dashboard, you can simply click "Add user" -> "Create user" with:
-- 1) Email: student@hostelhub.com | Password: your_password | User Metadata: {"full_name": "Aarav Sharma", "role": "student"}
-- 2) Email: warden@hostelhub.com  | Password: your_password | User Metadata: {"full_name": "Dr. Singh", "role": "warden"}
-- 3) Email: admin@hostelhub.com   | Password: your_password | User Metadata: {"full_name": "Admin User", "role": "admin"}
