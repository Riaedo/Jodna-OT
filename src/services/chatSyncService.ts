import { ChatMessage, ChatSession, UserProfile } from '../types/chat';
import { getSupabaseClient, getStoredSupabaseConfig } from '../lib/supabase';

const SYNC_USER_ID_KEY = 'gemini_sync_user_id_v1';

export const getDeviceSyncUserId = (): string => {
  let id = localStorage.getItem(SYNC_USER_ID_KEY);
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(SYNC_USER_ID_KEY, id);
  }
  return id;
};

export const setDeviceSyncUserId = (newId: string) => {
  if (newId && newId.trim()) {
    localStorage.setItem(SYNC_USER_ID_KEY, newId.trim());
  }
};

/**
 * Chat Storage and Synchronization Service
 * Handles Supabase (@supabase/supabase-js) + Cloud SQL REST API
 */
export class ChatSyncService {
  private static getHeaders(user: UserProfile | null, token: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-sync-user-id': user?.uid || getDeviceSyncUserId(),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Fetch all sessions
   */
  static async fetchSessions(user: UserProfile | null, token: string | null): Promise<ChatSession[]> {
    const supabase = getSupabaseClient();
    const activeUserId = user?.uid || getDeviceSyncUserId();

    // 1. If Supabase is connected, query Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', activeUserId)
          .order('pinned', { ascending: false })
          .order('updated_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            title: d.title,
            model: d.model || 'gemini-2.5-flash',
            systemInstruction: d.system_instruction,
            pinned: Boolean(d.pinned),
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase fetchSessions error, falling back to backend:', err);
      }
    }

    // 2. Fetch from Cloud SQL Backend
    try {
      const res = await fetch('/api/chat/sessions', {
        headers: this.getHeaders(user, token),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.warn('Cloud SQL fetchSessions error:', err);
    }

    // 3. Fallback to LocalStorage
    try {
      const local = localStorage.getItem('gemini_local_sessions');
      if (local) return JSON.parse(local);
    } catch (e) {
      console.error(e);
    }

    return [];
  }

  /**
   * Create or update a session
   */
  static async saveSession(
    session: ChatSession,
    user: UserProfile | null,
    token: string | null
  ): Promise<void> {
    const activeUserId = user?.uid || getDeviceSyncUserId();
    const sessionToSave = { ...session, userId: activeUserId };

    // 1. Sync to Supabase if connected
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('chat_sessions').upsert({
          id: sessionToSave.id,
          user_id: activeUserId,
          title: sessionToSave.title,
          model: sessionToSave.model,
          system_instruction: sessionToSave.systemInstruction || null,
          pinned: Boolean(sessionToSave.pinned),
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Supabase saveSession failed:', err);
      }
    }

    // 2. Sync to Cloud SQL Backend
    try {
      await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: this.getHeaders(user, token),
        body: JSON.stringify(sessionToSave),
      });
    } catch (err) {
      console.warn('Cloud SQL saveSession failed:', err);
    }

    // 3. Save to LocalStorage cache
    try {
      const local = localStorage.getItem('gemini_local_sessions');
      const list: ChatSession[] = local ? JSON.parse(local) : [];
      const idx = list.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        list[idx] = sessionToSave;
      } else {
        list.unshift(sessionToSave);
      }
      localStorage.setItem('gemini_local_sessions', JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Delete a session
   */
  static async deleteSession(
    sessionId: string,
    user: UserProfile | null,
    token: string | null
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('chat_messages').delete().eq('session_id', sessionId);
        await supabase.from('chat_sessions').delete().eq('id', sessionId);
      } catch (e) {
        console.warn('Supabase deleteSession error:', e);
      }
    }

    try {
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: this.getHeaders(user, token),
      });
    } catch (e) {
      console.warn('Cloud SQL deleteSession error:', e);
    }

    try {
      const local = localStorage.getItem('gemini_local_sessions');
      if (local) {
        const list: ChatSession[] = JSON.parse(local);
        localStorage.setItem(
          'gemini_local_sessions',
          JSON.stringify(list.filter((s) => s.id !== sessionId))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Fetch messages for a session
   */
  static async fetchMessages(
    sessionId: string,
    user: UserProfile | null,
    token: string | null
  ): Promise<ChatMessage[]> {
    const supabase = getSupabaseClient();

    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            sessionId: d.session_id,
            userId: d.user_id,
            role: d.role,
            content: d.content,
            imageUrl: d.image_url,
            thinking: d.thinking,
            createdAt: d.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase fetchMessages error:', err);
      }
    }

    // 2. Try Cloud SQL Backend
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        headers: this.getHeaders(user, token),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Cloud SQL fetchMessages error:', err);
    }

    // 3. Fallback LocalStorage
    try {
      const local = localStorage.getItem(`gemini_msgs_${sessionId}`);
      if (local) return JSON.parse(local);
    } catch (e) {
      console.error(e);
    }

    return [];
  }

  /**
   * Save a single message
   */
  static async saveMessage(
    message: ChatMessage,
    user: UserProfile | null,
    token: string | null
  ): Promise<void> {
    const activeUserId = user?.uid || getDeviceSyncUserId();
    const msgToSave = { ...message, userId: activeUserId };

    // 1. Supabase insert
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('chat_messages').upsert({
          id: msgToSave.id,
          session_id: msgToSave.sessionId,
          user_id: activeUserId,
          role: msgToSave.role,
          content: msgToSave.content,
          image_url: msgToSave.imageUrl || null,
          thinking: msgToSave.thinking || null,
        });
      } catch (e) {
        console.warn('Supabase saveMessage error:', e);
      }
    }

    // 2. Cloud SQL Backend insert
    try {
      await fetch(`/api/chat/sessions/${message.sessionId}/messages`, {
        method: 'POST',
        headers: this.getHeaders(user, token),
        body: JSON.stringify(msgToSave),
      });
    } catch (e) {
      console.warn('Cloud SQL saveMessage error:', e);
    }

    // 3. Cache in LocalStorage
    try {
      const key = `gemini_msgs_${message.sessionId}`;
      const local = localStorage.getItem(key);
      const list: ChatMessage[] = local ? JSON.parse(local) : [];
      list.push(msgToSave);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Subscribe to Supabase real-time updates for cross-device live sync
   */
  static subscribeToRealtime(
    sessionId: string,
    onNewMessage: (msg: ChatMessage) => void
  ): (() => void) | null {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const channel = supabase
        .channel(`session-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload: any) => {
            const raw = payload.new;
            if (raw) {
              onNewMessage({
                id: raw.id,
                sessionId: raw.session_id,
                userId: raw.user_id,
                role: raw.role,
                content: raw.content,
                imageUrl: raw.image_url,
                thinking: raw.thinking,
                createdAt: raw.created_at,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Failed to subscribe to Supabase channel:', err);
      return null;
    }
  }
}
