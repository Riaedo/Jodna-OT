import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ChatInput } from './components/ChatInput';
import { SupabaseModal } from './components/SupabaseModal';
import { SyncDeviceModal } from './components/SyncDeviceModal';
import {
  ChatSession,
  ChatMessage,
  SupabaseConfig,
  PersonaOption,
} from './types/chat';
import {
  getSavedConfig,
  fetchUserSessions,
  createNewSession,
  deleteSessionFromDb,
  updateSessionTitleInDb,
  fetchSessionMessages,
  saveMessageToDb,
  setupRealtimeSync,
  testSupabaseConnection,
} from './lib/supabase';
import { Sparkles, Database, Wifi } from 'lucide-react';

const PERSONAS: PersonaOption[] = [
  {
    id: 'general',
    name: 'ผู้ช่วยทั่วไป (General)',
    description: 'ตอบคำถามทุกเรื่องอย่างชัดเจน เป็นมิตร และมีเหตุผล',
    icon: '✨',
    systemPrompt:
      'คุณคือผู้ช่วย AI อัจฉริยะ (Gemini) ที่ตอบคำถามได้อย่างเป็นมิตร ละเอียด ถูกต้อง ชัดเจน พร้อมจัดรูปแบบ Markdown ที่สวยงาม อ่านง่าย รองรับการเขียนโค้ดและภาษาไทยอย่างยอดเยี่ยม',
  },
  {
    id: 'coding',
    name: 'ผู้เชี่ยวชาญการเขียนโค้ด (Coding)',
    description: 'เขียนโค้ด Debug สถาปัตยกรรมระบบ TypeScript, React, SQL',
    icon: '💻',
    systemPrompt:
      'คุณคือวิศวกรซอฟต์แวร์ระดับ Senior Full-Stack Specialist เชี่ยวชาญ TypeScript, React, Node.js, Python, Supabase, SQL, และการออกแบบสถาปัตยกรรมระบบ ให้คำตอบที่มีตัวอย่างโค้ดที่ถูกต้อง สมบูรณ์ ปลอดภัย พร้อมอธิบายหลักการทำงานอย่างละเอียด',
  },
  {
    id: 'thai-expert',
    name: 'ภาษาไทย & การเขียน (Thai Writer)',
    description: 'ขัดเกลาบทความ เรียบเรียงภาษาไทย สุภาพ สละสลวย',
    icon: '📝',
    systemPrompt:
      'คุณคือผู้เชี่ยวชาญภาษาไทย นักเขียนบทความ และที่ปรึกษาด้านการสื่อสาร ช่วยตรวจสอบตัวสะกด ไวยากรณ์ เรียบเรียงประโยคให้กระชับ สละสลวย ตรงประเด็น เหมาะสมกับกาลเทศะ',
  },
  {
    id: 'analyst',
    name: 'นักวิเคราะห์ข้อมูล (Data Analyst)',
    description: 'สรุปประเด็น สถิติ การวางแผนกลยุทธ์ และการตัดสินใจ',
    icon: '📊',
    systemPrompt:
      'คุณคือนักวิเคราะห์ข้อมูลและกลยุทธ์ธุรกิจ (Data & Business Analyst) ช่วยคิดเชิงวิพากษ์ สรุปข้อมูลซับซ้อนให้เข้าใจง่าย และแนะนำแนวทางแก้ปัญหาอย่างมีหลักการ',
  },
];

export function App() {
  const [config, setConfig] = useState<SupabaseConfig>(getSavedConfig());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaOption>(PERSONAS[0]);

  // Load initial sessions
  const loadSessions = useCallback(async (syncId: string) => {
    try {
      const data = await fetchUserSessions(syncId);
      setSessions(data);
      if (data.length > 0) {
        // If no active session, select the most recent one
        setActiveSessionId((prev) => prev || data[0].id);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  }, []);

  // Load messages for active session
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const msgs = await fetchSessionMessages(sessionId);
      setMessages(msgs);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, []);

  // Check Supabase connectivity on startup
  useEffect(() => {
    async function checkConnection() {
      if (config.url && config.anonKey) {
        const testRes = await testSupabaseConnection(config.url, config.anonKey);
        setConfig((prev) => ({ ...prev, isConnected: testRes.success }));
      }
    }
    checkConnection();
  }, [config.url, config.anonKey]);

  // Initial load
  useEffect(() => {
    loadSessions(config.userSyncId);
  }, [config.userSyncId, loadSessions]);

  // Load messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId, loadMessages]);

  // Setup Supabase Realtime synchronization across devices
  useEffect(() => {
    const cleanup = setupRealtimeSync(
      config.userSyncId,
      () => {
        // Callback when sessions update on another device (PC <-> Mobile)
        loadSessions(config.userSyncId);
      },
      (changedSessionId) => {
        // Callback when a new message arrives in any session
        if (changedSessionId === activeSessionId) {
          loadMessages(changedSessionId);
        }
      }
    );

    return () => {
      cleanup();
    };
  }, [config.userSyncId, activeSessionId, loadSessions, loadMessages]);

  // Handle New Chat
  const handleNewChat = async () => {
    try {
      const newSession = await createNewSession(config.userSyncId, 'บทสนทนาใหม่', 'gemini-3.8-flash');
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create new chat:', err);
    }
  };

  // Handle Delete Session
  const handleDeleteSession = async (sessionId: string) => {
    await deleteSessionFromDb(sessionId, config.userSyncId);
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  // Handle Rename Session
  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    await updateSessionTitleInDb(sessionId, newTitle);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
    );
  };

  // Handle Clear Messages in current session
  const handleClearSession = async () => {
    if (!activeSessionId) return;
    setMessages([]);
    // Update local storage cache
    localStorage.removeItem(`local_messages_${activeSessionId}`);
  };

  // Handle Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend !== undefined ? textToSend : input).trim();
    if (!promptText || isLoading) return;

    setInput('');
    setIsLoading(true);

    try {
      let currentSessionId = activeSessionId;

      // If no active session, create one first
      if (!currentSessionId) {
        const newSession = await createNewSession(
          config.userSyncId,
          promptText.slice(0, 30),
          'gemini-3.8-flash'
        );
        currentSessionId = newSession.id;
        setActiveSessionId(newSession.id);
        setSessions((prev) => [newSession, ...prev]);
      }

      // Save user message to DB & local state
      const savedUserMsg = await saveMessageToDb(
        currentSessionId,
        config.userSyncId,
        'user',
        promptText
      );

      const updatedMessages = [...messages, savedUserMsg];
      setMessages(updatedMessages);

      // Call server-side Gemini API (/api/chat)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          systemInstruction: selectedPersona.systemPrompt,
          model: 'gemini-3.8-flash',
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      const assistantText = data.text || 'ไม่สามารถรับคำตอบจาก Gemini ได้ โปรดลองใหม่อีกครั้ง';

      // Save assistant message to DB & local state
      const savedAssistantMsg = await saveMessageToDb(
        currentSessionId,
        config.userSyncId,
        'assistant',
        assistantText
      );

      setMessages((prev) => [...prev, savedAssistantMsg]);

      // If it's the first message of the session, auto-generate a smart title
      const isFirstTurn = messages.length === 0;
      if (isFirstTurn && currentSessionId) {
        fetch('/api/chat/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstMessage: promptText }),
        })
          .then((res) => res.json())
          .then((titleData) => {
            if (titleData.title && currentSessionId) {
              handleRenameSession(currentSessionId, titleData.title);
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      console.error('Send message error:', err);
      // Append error message to chat
      if (activeSessionId) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          session_id: activeSessionId,
          user_sync_id: config.userSyncId,
          role: 'assistant',
          content: `⚠️ ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อกับ Gemini:\n\`\`\`\n${err?.message || 'Network or Server Error'}\n\`\`\`\nโปรดตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-['Prompt',sans-serif]">
      {/* Sidebar with conversation list & device sync */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => setActiveSessionId(id)}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        isSupabaseConnected={config.isConnected}
        userSyncId={config.userSyncId}
      />

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Unconfigured Supabase Banner (friendly callout) */}
        {!config.isConnected && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2 truncate">
              <Database className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                คุณมี Supabase URL และ Anon Key หรือไม่? เชื่อมต่อเพื่อซิงค์ประวัติแชทข้าม PC และ มือถือ ทันที
              </span>
            </div>
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="ml-3 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0 transition cursor-pointer text-xs"
            >
              ตั้งค่าเชื่อมต่อ
            </button>
          </div>
        )}

        {/* Chat History & Messages Area */}
        <ChatArea
          session={activeSession}
          messages={messages}
          isLoading={isLoading}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onClearSession={handleClearSession}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          isSupabaseConnected={config.isConnected}
          selectedPersona={selectedPersona}
          onSelectPersona={setSelectedPersona}
          personas={PERSONAS}
          onPromptStarterClick={(prompt) => handleSendMessage(prompt)}
        />

        {/* Input Bar */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={(customMsg) => handleSendMessage(customMsg)}
          isLoading={isLoading}
        />
      </main>

      {/* Supabase Credentials & SQL Schema Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        currentUrl={config.url}
        currentAnonKey={config.anonKey}
        currentSyncId={config.userSyncId}
        onConfigSaved={(url, anonKey) => {
          setConfig((prev) => ({ ...prev, url, anonKey, isConnected: true }));
          loadSessions(config.userSyncId);
        }}
      />

      {/* Multi-Device Sync & Pairing Modal */}
      <SyncDeviceModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        currentSyncId={config.userSyncId}
        supabaseUrl={config.url}
        supabaseAnonKey={config.anonKey}
        onSyncIdChanged={(newSyncId) => {
          setConfig((prev) => ({ ...prev, userSyncId: newSyncId }));
          loadSessions(newSyncId);
        }}
      />
    </div>
  );
}

export default App;
