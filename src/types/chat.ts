export interface ChatSession {
  id: string;
  user_sync_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_sync_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  userSyncId: string;
  isConnected: boolean;
  statusMessage?: string;
}

export interface PersonaOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
}
