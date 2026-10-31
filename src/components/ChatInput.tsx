import React, { useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (message?: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const QUICK_PROMPTS = [
  '⚡ ช่วยเขียนโค้ด TypeScript & Supabase',
  '📝 สรุปสาระสำคัญของบทความนี้',
  '🇹🇭 ตรวจสอบและขัดเกลาไวยากรณ์ภาษาไทย',
  '💡 ออกแบบสถาปัตยกรรมระบบ Web Application',
];

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 md:px-4 pb-3 md:pb-4 pt-1">
      {/* Quick Prompts on empty input */}
      {!input.trim() && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar text-xs">
          {QUICK_PROMPTS.map((prompt, index) => (
            <button
              key={index}
              onClick={() => onSend(prompt.replace(/^[^\s]+\s/, ''))}
              className="shrink-0 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="relative rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-xl focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์ข้อความถาม Gemini... (กด Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
          rows={1}
          disabled={disabled || isLoading}
          className="w-full pl-4 pr-14 py-3.5 bg-transparent text-slate-100 placeholder-slate-500 text-sm md:text-base focus:outline-none resize-none leading-relaxed max-h-[180px] overflow-y-auto"
        />

        <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
          <button
            onClick={() => onSend()}
            disabled={!input.trim() || isLoading || disabled}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
            title="ส่งข้อความ (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 px-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Gemini 3.8 Flash • ประวัติแชทซิงค์ผ่าน Supabase Realtime</span>
        </div>
        <span className="hidden sm:inline">กด Shift + Enter เพื่อขึ้นบรรทัดใหม่</span>
      </div>
    </div>
  );
};
