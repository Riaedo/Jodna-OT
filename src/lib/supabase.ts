import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

const STORAGE_KEY = 'gemini_supabase_config_v1';

export const getStoredSupabaseConfig = (): SupabaseConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse stored Supabase config:', err);
  }
  return {
    url: (import.meta as any).env?.VITE_SUPABASE_URL || '',
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
    enabled: Boolean((import.meta as any).env?.VITE_SUPABASE_URL && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY),
  };
};

export const saveStoredSupabaseConfig = (cfg: SupabaseConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    // Reset client cache so new instance uses updated config
    supabaseClientInstance = null;
  } catch (err) {
    console.error('Failed to save Supabase config:', err);
  }
};

let supabaseClientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseClientInstance) return supabaseClientInstance;

  const cfg = getStoredSupabaseConfig();
  if (cfg.enabled && cfg.url && cfg.anonKey) {
    try {
      supabaseClientInstance = createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseClientInstance;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
};

/**
 * Test connectivity to user's Supabase instance
 */
export const testSupabaseConnection = async (url: string, key: string): Promise<{ ok: boolean; message: string }> => {
  if (!url || !key) {
    return { ok: false, message: 'กรุณากรอกทั้ง Supabase URL และ Anon Key' };
  }
  try {
    const testClient = createClient(url, key);
    // Simple ping query
    const { error } = await testClient.from('chat_sessions').select('id').limit(1);
    if (error && error.code !== 'PGRST116' && !error.message.includes('relation') && !error.message.includes('not found')) {
      // If error is about authentication/JWT, it's invalid
      if (error.message.includes('JWT') || error.message.includes('apikey') || error.code === '401' || error.code === 'PGRST301') {
        return { ok: false, message: `ยืนยันตัวตนล้มเหลว: ${error.message}` };
      }
    }
    return { ok: true, message: 'เชื่อมต่อ Supabase สำเร็จ พร้อมซิงค์ประวัติการแชท!' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'ไม่สามารถเชื่อมต่อ Supabase ได้' };
  }
};
