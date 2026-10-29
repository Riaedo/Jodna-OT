import React, { useRef, useEffect, useState } from 'react';
import {
  Menu,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  Share2,
  Trash2,
  Database,
  Code,
  FileText,
  Languages,
  Brain,
  ChevronDown,
} from 'lucide-react';
import { ChatMessage, ChatSession, PersonaOption } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatAreaProps {
  session: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  onOpenMobileMenu: () => void;
  onClearSession: () => void;
  onOpenSupabaseModal: () => void;
  onOpenSyncModal: () => void;
  isSupabaseConnected: boolean;
  selectedPersona: PersonaOption;
  onSelectPersona: (persona: PersonaOption) => void;
  personas: PersonaOption[];
  onPromptStarterClick: (prompt: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  session,
  messages,
  isLoading,
  onOpenMobileMenu,
  onClearSession,
  onOpenSupabaseModal,
  onOpenSyncModal,
  isSupabaseConnected,
  selectedPersona,
  onSelectPersona,
  personas,
  onPromptStarterClick,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  // Auto-scroll to bottom when messages update or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportMarkdown = () => {
    if (!messages.length) return;
    const content = messages
      .map((m) => `### ${m.role === 'user' ? 'คุณ' : 'Gemini'}\n\n${m.content}\n\n---`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session?.title || 'gemini-chat'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0 bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="เปิดเมนูประวัติแชท"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md">
              {session?.title || 'บทสนทนาใหม่'}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-indigo-400">
                <Sparkles className="w-3 h-3" />
                gemini-3.8-flash
              </span>
              <span>•</span>
              <span className="truncate">{selectedPersona.name}</span>
            </div>
          </div>
        </div>

        {/* Right Action Icons & Persona Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Persona Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs transition cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">{selectedPersona.name}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showPersonaMenu && (
              <div className="absolute right-0 mt-1 w-64 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl py-1 z-30 animate-fadeIn text-xs">
                <div className="px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  เลือกโหมดการทำงานของ AI
                </div>
                {personas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPersona(p);
                      setShowPersonaMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-slate-800 transition cursor-pointer ${
                      selectedPersona.id === p.id ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-300'
                    }`}
                  >
                    <span className="text-sm mt-0.5">{p.icon}</span>
                    <div>
                      <div className="font-medium text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Markdown */}
          {messages.length > 0 && (
            <button
              onClick={handleExportMarkdown}
              title="ส่งออกแชท (Markdown)"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer hidden sm:block"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {/* Clear Session */}
          {messages.length > 0 && (
            <button
              onClick={onClearSession}
              title="ล้างข้อความในห้องนี้"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Messages Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">
        {messages.length === 0 ? (
          // Empty State Greeting
          <div className="max-w-2xl mx-auto py-8 text-center space-y-8 animate-fadeIn">
            <div className="space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-500/20 text-white">
                <Sparkles className="w-7 h-7" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                ยินดีต้อนรับสู่ Gemini Chat
              </h1>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                ระบบแชทอัจฉริยะที่ซิงค์ประวัติบทสนทนาข้าม PC และ มือถือ ทันทีผ่าน Supabase Realtime
              </p>
            </div>

            {/* Quick Starters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <button
                onClick={() => onPromptStarterClick('ช่วยเขียนฟังก์ชัน TypeScript สำหรับเชื่อมต่อและดึงข้อมูลจาก Supabase พร้อมตัวอย่าง')}
                className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-indigo-400 mb-1.5 font-medium text-xs">
                  <Code className="w-4 h-4" />
                  เขียนโค้ดและพัฒนาเว็บ
                </div>
                <p className="text-xs text-slate-300 group-hover:text-white leading-relaxed">
                  สร้างฟังก์ชัน TypeScript เชื่อมต่อ Supabase
                </p>
              </button>

              <button
                onClick={() => onPromptStarterClick('ช่วยออกแบบโครงสร้างฐานข้อมูล (Database Schema) สำหรับระบบอีคอมเมิร์ซขนาดเล็ก')}
                className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-emerald-400 mb-1.5 font-medium text-xs">
                  <Database className="w-4 h-4" />
                  ออกแบบระบบและฐานข้อมูล
                </div>
                <p className="text-xs text-slate-300 group-hover:text-white leading-relaxed">
                  แนะนำ Database Schema สำหรับระบบ E-commerce
                </p>
              </button>

              <button
                onClick={() => onPromptStarterClick('ช่วยเขียนบทความแนะนำ 5 เทคนิคเพิ่มประสิทธิภาพการทำงานแบบมืออาชีพ')}
                className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-amber-400 mb-1.5 font-medium text-xs">
                  <FileText className="w-4 h-4" />
                  เขียนบทความและเนื้อหา
                </div>
                <p className="text-xs text-slate-300 group-hover:text-white leading-relaxed">
                  5 เทคนิคเพิ่มประสิทธิภาพการทำงานแบบมืออาชีพ
                </p>
              </button>

              <button
                onClick={() => onPromptStarterClick('ช่วยแปลและสรุปใจความสำคัญของข้อความนี้เป็นภาษาไทยที่สุภาพและกระชับ')}
                className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-pink-400 mb-1.5 font-medium text-xs">
                  <Languages className="w-4 h-4" />
                  แปลและสรุปสาระสำคัญ
                </div>
                <p className="text-xs text-slate-300 group-hover:text-white leading-relaxed">
                  แปลและสรุปเนื้อหาเป็นภาษาไทยที่กระชับ สุภาพ
                </p>
              </button>
            </div>
          </div>
        ) : (
          // Message List
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const isCopied = copiedId === message.id;

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 md:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20 mt-1">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className={`relative max-w-[88%] md:max-w-[80%] rounded-2xl p-4 shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                        {message.content}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <MarkdownRenderer content={message.content} />

                        {/* Assistant Action Bar */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800/80 text-xs text-slate-400">
                          <span className="text-[10px] text-slate-500">
                            {new Date(message.created_at).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <button
                            onClick={() => handleCopyMessage(message.content, message.id)}
                            className="flex items-center gap-1 hover:text-white transition px-2 py-1 rounded hover:bg-slate-800 cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 text-[11px]">คัดลอกแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[11px]">คัดลอก</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading / Thinking State Indicator */}
            {isLoading && (
              <div className="flex gap-3 md:gap-4 justify-start animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="ml-1 text-slate-300 font-medium">Gemini กำลังคิดและตอบคำถาม...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};
