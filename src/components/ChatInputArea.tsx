import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Square, 
  ImagePlus, 
  X, 
  Mic, 
  MicOff, 
  Sparkles,
  Paperclip
} from 'lucide-react';

interface ChatInputAreaProps {
  onSendMessage: (text: string, imageBase64?: string, imageMime?: string) => void;
  isStreaming: boolean;
  onStopStreaming?: () => void;
  disabled?: boolean;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  disabled,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // Voice recognition support (SpeechRecognition)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        setIsListening(false);
      }
    } else {
      try {
        recognition.stop();
      } catch (e) {}
    }

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isListening]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage({
        base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = () => {
    if ((!inputText.trim() && !selectedImage) || isStreaming || disabled) return;

    onSendMessage(inputText.trim(), selectedImage?.base64, selectedImage?.mimeType);
    setInputText('');
    setSelectedImage(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-3 sm:px-6 pb-3 pt-1">
      {/* Attached image preview pill */}
      {selectedImage && (
        <div className="mb-2 inline-flex items-center gap-2 p-1.5 pr-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <img
            src={selectedImage.base64}
            alt="พรีวิวรูปภาพ"
            className="w-12 h-12 object-cover rounded-xl"
          />
          <div className="text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200 block truncate max-w-[150px]">
              รูปภาพแนบ
            </span>
            <span className="text-[10px] text-slate-400">พร้อมส่งให้ Gemini วิเคราะห์</span>
          </div>
          <button
            onClick={() => setSelectedImage(null)}
            className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ml-1"
            title="ลบรูปภาพนี้"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main input wrapper container */}
      <div className="relative flex flex-col bg-white dark:bg-slate-850 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-md focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ถามอะไรก็ได้กับ Gemini... (กด Enter เพื่อส่ง, Shift + Enter เพื่อขึ้นบรรทัดใหม่)"
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent resize-none px-4 pt-3.5 pb-2 text-sm sm:text-base text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none min-h-[50px] max-h-[200px]"
        />

        {/* Action bar below textarea */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          {/* Left Buttons: Image upload, Voice mic */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs"
              title="แนบรูปภาพเพื่อวิเคราะห์"
            >
              <ImagePlus className="w-4 h-4" />
              <span className="hidden sm:inline">แนบภาพ</span>
            </button>

            {/* Voice Dictation toggle */}
            <button
              type="button"
              onClick={() => setIsListening(!isListening)}
              className={`p-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isListening ? 'กำลังฟังเสียง... คลิกเพื่อหยุด' : 'พิมพ์ด้วยเสียง'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="hidden sm:inline">{isListening ? 'กำลังฟัง...' : 'เสียง'}</span>
            </button>
          </div>

          {/* Right Button: Send or Stop */}
          <div>
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs sm:text-sm shadow-md transition-all active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>หยุด</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputText.trim() && !selectedImage}
                className={`flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-xl font-medium text-xs sm:text-sm shadow-sm transition-all ${
                  inputText.trim() || selectedImage
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
                title="ส่งข้อความ"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline ml-1.5">ส่ง</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
