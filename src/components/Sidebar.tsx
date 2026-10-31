import React, { useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Search, 
  Pin, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  Laptop, 
  Smartphone, 
  Database,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';
import { ChatSession } from '../types/chat';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onOpenSyncModal: () => void;
  onOpenSystemPromptModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onCloseMobile,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
  onOpenSyncModal,
  onOpenSystemPromptModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header / New Chat */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onCloseMobile();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-500/20 active:scale-98 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>การสนทนาใหม่</span>
            </button>
            <button
              onClick={onCloseMobile}
              className="md:hidden ml-2 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหาประวัติการแชท..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
              <MessageSquare className="w-6 h-6 mx-auto opacity-50" />
              <p>{searchTerm ? 'ไม่พบการสนทนาที่ค้นหา' : 'ยังไม่มีประวัติการแชท'}</p>
            </div>
          ) : (
            filtered.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    if (window.innerWidth < 768) onCloseMobile();
                  }}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-semibold shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    
                    {isEditing ? (
                      <form onSubmit={(e) => saveRename(session.id, e)} className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs border border-indigo-400 focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button type="submit" onClick={(e) => saveRename(session.id, e)} className="text-emerald-500 hover:text-emerald-600 p-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={cancelRename} className="text-slate-400 hover:text-rose-500 p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <span className="truncate flex-1">
                        {session.title || 'การสนทนาใหม่'}
                      </span>
                    )}

                    {session.pinned && !isEditing && (
                      <Pin className="w-2.5 h-2.5 text-indigo-500 fill-indigo-500 shrink-0" />
                    )}
                  </div>

                  {/* Action buttons (Pin, Edit, Delete) */}
                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(session.id, Boolean(session.pinned));
                        }}
                        className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 ${
                          session.pinned ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title={session.pinned ? 'ยกเลิกการปักหมุด' : 'ปักหมุดด้านบน'}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => startRename(session, e)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="เปลี่ยนชื่อหัวข้อ"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="ลบการสนทนา"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Bar: System Prompt & Sync status */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onOpenSystemPromptModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>ปรับแต่งคำสั่งระบบ (System Prompt)</span>
            </span>
          </button>

          {/* Device Sync & Supabase trigger button */}
          <button
            onClick={onOpenSyncModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>ซิงค์ PC 💻 ⟷ มือถือ 📱</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
              Cloud SQL & Supabase
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
