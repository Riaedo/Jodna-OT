import React, { useState } from 'react';
import { ChatMessage } from '../types/chat';
import { 
  Bot, 
  User, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ChevronDown, 
  ChevronRight,
  Code2
} from 'lucide-react';
import { marked } from 'marked';

// Configure marked for clean code blocks and links
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message, isStreaming }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = 'th-TH';
    utterance.rate = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const renderContentHtml = () => {
    try {
      return { __html: marked.parse(message.content) as string };
    } catch {
      return { __html: message.content.replace(/\n/g, '<br/>') };
    }
  };

  return (
    <div
      className={`py-4 px-3 sm:px-6 transition-colors duration-150 flex gap-3 sm:gap-4 max-w-4xl mx-auto w-full ${
        isUser
          ? 'bg-transparent'
          : 'bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl sm:rounded-3xl border border-slate-200/50 dark:border-slate-800/50'
      }`}
    >
      {/* Avatar Icon */}
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header (Role & Time) */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {isUser ? 'คุณ' : 'Gemini'}
          </span>
          <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100">
            {!isUser && !isStreaming && (
              <>
                <button
                  onClick={handleSpeak}
                  title={isSpeaking ? 'หยุดอ่าน' : 'อ่านออกเสียง'}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleCopy}
                  title="คัดลอกข้อความ"
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
            {isUser && (
              <button
                onClick={handleCopy}
                title="คัดลอกข้อความ"
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Attached image if present */}
        {message.imageUrl && (
          <div className="my-2">
            <img
              src={message.imageUrl}
              alt="แนบรูปภาพ"
              className="max-h-72 rounded-xl object-contain border border-slate-200 dark:border-slate-700 shadow-sm"
            />
          </div>
        )}

        {/* Thinking block if present */}
        {message.thinking && (
          <div className="my-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 overflow-hidden text-xs">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="w-full flex items-center justify-between px-3 py-2 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40"
            >
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                กระบวนการคิดวิเคราะห์ (Thinking Process)
              </span>
              {showThinking ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {showThinking && (
              <div className="p-3 border-t border-indigo-100 dark:border-indigo-900/40 text-slate-600 dark:text-slate-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Main Text Content */}
        <div
          className={`prose prose-slate dark:prose-invert max-w-none text-sm sm:text-[15px] leading-relaxed break-words ${
            isStreaming ? 'animate-pulse' : ''
          }`}
          dangerouslySetInnerHTML={renderContentHtml()}
        />

        {/* Streaming Cursor indicator */}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-indigo-600 dark:bg-indigo-400 ml-1 animate-ping rounded-sm" />
        )}
      </div>
    </div>
  );
};
