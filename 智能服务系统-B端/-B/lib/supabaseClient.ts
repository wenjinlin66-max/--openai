import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
// Using process.env instead of import.meta.env to avoid TS errors
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kbkocmjvthhfnfwdxrwi.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia29jbWp2dGhoZm5md2R4cndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MjE2OTMsImV4cCI6MjA3OTM5NzY5M30.0HT1qqIhaL2PRQPdiF_D8sxFJsREiuHjFaUojHxtvS4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && 
         SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' && 
         SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
};

// Auth Helper Functions
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};