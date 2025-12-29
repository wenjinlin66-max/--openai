import { createClient } from '@supabase/supabase-js';

// 这里的 Key 和 URL 与 B 端项目完全一致，确保数据互通
const SUPABASE_URL = 'https://vhgwvdurnkecxvuvcrpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZ3d2ZHVybmtlY3h2dXZjcnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NTgyOTQsImV4cCI6MjA3OTIzNDI5NH0.agAQym2eYwINVHQTVak_AzM4iF8t1u9aas1VaYpJfDM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);