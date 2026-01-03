// 使用 import.meta.env 获取环境变量，这是 Vite 的标准做法
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 打印一下，确保地址是以 "vhgw..." 开头的，而不是 "kbkoc..."
console.log("当前使用的 Supabase 地址:", SUPABASE_URL);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("错误：Supabase 环境变量缺失，请检查 .env 文件并重启项目！");
}

import { createClient } from '@supabase/supabase-js';

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