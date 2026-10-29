import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { ChatSession, ChatMessage, SupabaseConfig } from '../types/chat';

const STORAGE_KEYS = {
  URL: 'gemini_supabase_url',
  ANON_KEY: 'gemini_supabase_anon_key',
  SYNC_ID: 'gemini_user_sync_id',
};

// Generate a random 6-8 character readable device sync code
export function generateSyncId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'SYNC-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Retrieve saved configuration or environment variable fallbacks
export function getSavedConfig(): SupabaseConfig {
  // Check URL query parameters first (convenient for sharing sync link to mobile)
  const params = new URLSearchParams(window.location.search);
  const paramUrl = params.get('sb_url');
  const paramKey = params.get('sb_key');
  const paramSync = params.get('sync_id');

  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

  const storedUrl = localStorage.getItem(STORAGE_KEYS.URL) || '';
  const storedKey = localStorage.getItem(STORAGE_KEYS.ANON_KEY) || '';
  let storedSync = localStorage.getItem(STORAGE_KEYS.SYNC_ID);

  if (!storedSync) {
    storedSync = paramSync || generateSyncId();
    localStorage.setItem(STORAGE_KEYS.SYNC_ID, storedSync);
  }

  const url = paramUrl || storedUrl || envUrl;
  const anonKey = paramKey || storedKey || envKey;
  const userSyncId = paramSync || storedSync;

  // Save if came from query parameters
  if (paramUrl && !storedUrl) localStorage.setItem(STORAGE_KEYS.URL, paramUrl);
  if (paramKey && !storedKey) localStorage.setItem(STORAGE_KEYS.ANON_KEY, paramKey);
  if (paramSync && paramSync !== storedSync) localStorage.setItem(STORAGE_KEYS.SYNC_ID, paramSync);

  return {
    url,
    anonKey,
    userSyncId,
    isConnected: false,
  };
}

let supabaseInstance: SupabaseClient | null = null;
let currentConfigKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSavedConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  const key = `${config.url}:::${config.anonKey}`;
  if (!supabaseInstance || currentConfigKey !== key) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      currentConfigKey = key;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }

  return supabaseInstance;
}

export function saveSupabaseConfig(url: string, anonKey: string, syncId: string) {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  const cleanSync = syncId.trim();

  localStorage.setItem(STORAGE_KEYS.URL, cleanUrl);
  localStorage.setItem(STORAGE_KEYS.ANON_KEY, cleanKey);
  localStorage.setItem(STORAGE_KEYS.SYNC_ID, cleanSync);

  // Invalidate current client to force re-creation
  supabaseInstance = null;
  currentConfigKey = '';

  return getSupabaseClient();
}

// Test connection to Supabase
export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      return { success: false, message: 'กรุณากรอก Supabase URL และ Anon Key' };
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return { success: false, message: 'URL ต้องขึ้นต้นด้วย https://' };
    }

    const testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    // Check table accessibility
    const { error } = await testClient.from('chat_sessions').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        // Table does not exist yet
        return {
          success: true,
          message: 'เชื่อมต่อ Supabase สำเร็จ! (แต่ยังไม่พบตาราง chat_sessions กรุณากดรัน SQL Schema ในหน้าจัดการ)',
        };
      }
      return {
        success: false,
        message: `เกิดข้อผิดพลาดจาก Supabase: ${error.message} (${error.code || 'RLS/Auth'})`,
      };
    }

    return { success: true, message: 'เชื่อมต่อและตรวจสอบตาราง Supabase เรียบร้อยแล้ว พร้อมซิงค์ข้อมูล!' };
  } catch (err: any) {
    return { success: false, message: `ไม่สามารถเชื่อมต่อได้: ${err?.message || 'โปรดตรวจสอบ URL และ Key'}` };
  }
}

// ==========================================
// Database Operations for Chat Sessions & Messages
// ==========================================

export async function fetchUserSessions(userSyncId: string): Promise<ChatSession[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    // Return local cache if unconfigured
    const local = localStorage.getItem(`local_sessions_${userSyncId}`);
    return local ? JSON.parse(local) : [];
  }

  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_sync_id', userSyncId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Error fetching sessions from Supabase:', error);
      const local = localStorage.getItem(`local_sessions_${userSyncId}`);
      return local ? JSON.parse(local) : [];
    }

    // Save to local cache as backup
    localStorage.setItem(`local_sessions_${userSyncId}`, JSON.stringify(data || []));
    return (data as ChatSession[]) || [];
  } catch (e) {
    console.error('Fetch sessions failed:', e);
    const local = localStorage.getItem(`local_sessions_${userSyncId}`);
    return local ? JSON.parse(local) : [];
  }
}

export async function createNewSession(
  userSyncId: string,
  title: string = 'บทสนทนาใหม่',
  model: string = 'gemini-3.8-flash'
): Promise<ChatSession> {
  const newSession: ChatSession = {
    id: crypto.randomUUID(),
    user_sync_id: userSyncId,
    title,
    model,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    // Local fallback
    const localSessions = await fetchUserSessions(userSyncId);
    const updated = [newSession, ...localSessions];
    localStorage.setItem(`local_sessions_${userSyncId}`, JSON.stringify(updated));
    return newSession;
  }

  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        id: newSession.id,
        user_sync_id: newSession.user_sync_id,
        title: newSession.title,
        model: newSession.model,
      })
      .select()
      .single();

    if (error) {
      console.warn('Insert session error:', error);
      // Fallback
      const localSessions = await fetchUserSessions(userSyncId);
      localStorage.setItem(`local_sessions_${userSyncId}`, JSON.stringify([newSession, ...localSessions]));
      return newSession;
    }

    return data as ChatSession;
  } catch (err) {
    console.error('Create session exception:', err);
    return newSession;
  }
}

export async function updateSessionTitleInDb(sessionId: string, title: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    await supabase
      .from('chat_sessions')
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  } catch (err) {
    console.error('Update title error:', err);
  }
}

export async function deleteSessionFromDb(sessionId: string, userSyncId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const local = localStorage.getItem(`local_sessions_${userSyncId}`);
    if (local) {
      const list = JSON.parse(local).filter((s: ChatSession) => s.id !== sessionId);
      localStorage.setItem(`local_sessions_${userSyncId}`, JSON.stringify(list));
    }
    localStorage.removeItem(`local_messages_${sessionId}`);
    return;
  }

  try {
    // Cascade delete on Supabase handles chat_messages
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
  } catch (err) {
    console.error('Delete session error:', err);
  }
}

export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const local = localStorage.getItem(`local_messages_${sessionId}`);
    return local ? JSON.parse(local) : [];
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Fetch messages error:', error);
      const local = localStorage.getItem(`local_messages_${sessionId}`);
      return local ? JSON.parse(local) : [];
    }

    localStorage.setItem(`local_messages_${sessionId}`, JSON.stringify(data || []));
    return (data as ChatMessage[]) || [];
  } catch (err) {
    console.error('Fetch messages exception:', err);
    const local = localStorage.getItem(`local_messages_${sessionId}`);
    return local ? JSON.parse(local) : [];
  }
}

export async function saveMessageToDb(
  sessionId: string,
  userSyncId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const newMsg: ChatMessage = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    user_sync_id: userSyncId,
    role,
    content,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    const local = localStorage.getItem(`local_messages_${sessionId}`);
    const list = local ? JSON.parse(local) : [];
    list.push(newMsg);
    localStorage.setItem(`local_messages_${sessionId}`, JSON.stringify(list));
    return newMsg;
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        id: newMsg.id,
        session_id: sessionId,
        user_sync_id: userSyncId,
        role: newMsg.role,
        content: newMsg.content,
      })
      .select()
      .single();

    // Also update session updated_at
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      console.warn('Insert message error:', error);
      return newMsg;
    }

    return data as ChatMessage;
  } catch (err) {
    console.error('Save message error:', err);
    return newMsg;
  }
}

// Setup Realtime Subscription to sync across PC & Mobile
export function setupRealtimeSync(
  userSyncId: string,
  onSessionChange: () => void,
  onMessageChange: (sessionId: string) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const channelName = `sync_${userSyncId.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  const channel: RealtimeChannel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_sync_id=eq.${userSyncId}`,
      },
      () => {
        onSessionChange();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `user_sync_id=eq.${userSyncId}`,
      },
      (payload) => {
        const sessionId = (payload.new as any)?.session_id || (payload.old as any)?.session_id;
        if (sessionId) {
          onMessageChange(sessionId);
        }
      }
    )
    .subscribe((status) => {
      console.log(`Supabase Realtime Sync status for ${userSyncId}:`, status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
