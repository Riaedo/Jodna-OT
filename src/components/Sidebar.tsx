import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Database,
  Smartphone,
  Search,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { ChatSession } from '../types/chat';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSupabaseModal: () => void;
  onOpenSyncModal: () => void;
  isSupabaseConnected: boolean;
  userSyncId: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isMobileOpen,
  onCloseMobile,
  onOpenSupabaseModal,
  onOpenSyncModal,
  isSupabaseConnected,
  userSyncId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveRename = (sessionId: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
  };

  // Group sessions by date
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const groups: { label: string; items: ChatSession[] }[] = [
    { label: 'วันนี้', items: [] },
    { label: 'เมื่อวาน', items: [] },
    { label: 'ก่อนหน้า', items: [] },
  ];

  filteredSessions.forEach((session) => {
    const sDate = new Date(session.updated_at || session.created_at);
    if (sDate.toDateString() === todayStr) {
      groups[0].items.push(session);
    } else if (sDate.toDateString() === yesterdayStr) {
      groups[1].items.push(session);
    } else {
      groups[2].items.push(session);
    }
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-80 bg-slate-900/95 md:bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header & Branding */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                Gemini Chat
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                  3.8
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Sync with Supabase</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            สร้างแชทใหม่ (New Chat)
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาบทสนทนา..."
              className="w-full pl-8.5 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4 text-xs">
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.label} className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </div>
                  {group.items.map((session) => {
                    const isActive = session.id === activeSessionId;
                    const isEditing = editingId === session.id;

                    return (
                      <div
                        key={session.id}
                        onClick={() => {
                          onSelectSession(session.id);
                          onCloseMobile();
                        }}
                        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          isActive
                            ? 'bg-indigo-600/20 text-white border border-indigo-500/30 font-medium'
                            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        {isEditing ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 w-full"
                          >
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              autoFocus
                              className="w-full px-2 py-1 rounded bg-slate-800 border border-indigo-500 text-white text-xs focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename(session.id, e);
                                if (e.key === 'Escape') cancelRename(e as any);
                              }}
                            />
                            <button
                              onClick={(e) => saveRename(session.id, e)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelRename}
                              className="p-1 text-slate-400 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <MessageSquare
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'
                                }`}
                              />
                              <span className="truncate">{session.title}</span>
                            </div>

                            {/* Actions on hover/active */}
                            <div
                              className={`flex items-center gap-1 ${
                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              } transition-opacity shrink-0`}
                            >
                              <button
                                onClick={(e) => startRename(session, e)}
                                title="เปลี่ยนชื่อ"
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(session.id, e)}
                                title="ลบแชท"
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
          )}

          {sessions.length === 0 && (
            <div className="text-center py-8 px-4 text-slate-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">ยังไม่มีประวัติการแชท</p>
              <p className="text-[11px] text-slate-600 mt-0.5">กดปุ่มสร้างแชทใหม่เพื่อเริ่มคุย</p>
            </div>
          )}
        </div>

        {/* Bottom Status & Sync Controls */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
          {/* Supabase Connection Status Button */}
          <button
            onClick={onOpenSupabaseModal}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer border ${
              isSupabaseConnected
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left">
                <span className="font-semibold block text-[11px]">
                  {isSupabaseConnected ? 'Supabase เชื่อมต่อแล้ว' : 'ตั้งค่า Supabase'}
                </span>
                <span className="text-[10px] opacity-75">
                  {isSupabaseConnected ? 'ซิงค์ข้อมูล Real-time' : 'คลิกเพื่อใส่ URL & Key'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Device Sync ID Button */}
          <button
            onClick={onOpenSyncModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-xs transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block">รหัสซิงค์ PC & มือถือ</span>
                <span className="font-mono text-[11px] text-indigo-300 font-semibold">{userSyncId}</span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
              จับคู่
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
