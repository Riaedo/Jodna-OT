import React, { useState } from 'react';
import { X, SlidersHorizontal, Check, Sparkles, RotateCcw } from 'lucide-react';

interface SystemInstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInstruction: string;
  onSave: (instruction: string) => void;
}

const PRESET_TEMPLATES = [
  {
    title: 'ผู้ช่วยทั่วไป (ค่าเริ่มต้น)',
    desc: 'ตอบภาษาไทยอย่างสุภาพ กระชับ ถูกต้อง และเข้าใจง่าย',
    prompt: 'คุณคือผู้ช่วยอัจฉริยะ Gemini ที่ตอบคำถามอย่างเป็นประโยชน์ ถูกต้อง ละเอียด และเป็นมิตร ใช้ภาษาไทยเป็นหลักและจัดรูปแบบคำตอบด้วย Markdown อย่างสวยงาม',
  },
  {
    title: 'ผู้เชี่ยวชาญการเขียนโค้ด (Senior Software Engineer)',
    desc: 'เน้นตอบเป็นโค้ดภาษา TypeScript, Python, SQL พร้อมอธิบาย Best Practices',
    prompt: 'คุณคือ Senior Software Engineer ผู้เชี่ยวชาญการพัฒนาเว็บแอปพลิเคชัน Full-stack, Database (PostgreSQL, Supabase) และ Cloud Architecture จงตอบด้วยโค้ดที่รัดกุม ปลอดภัย และมีคำอธิบายที่ชัดเจน',
  },
  {
    title: 'นักแปลและปรับสำนวนมืออาชีพ',
    desc: 'แปลระหว่างภาษาไทยและภาษาอังกฤษอย่างสละสลวย',
    prompt: 'คุณคือนักแปลและนักประพันธ์ระดับมืออาชีพ ช่วยแปลข้อความและปรับสำนวนภาษาให้มีความเป็นธรรมชาติ ถูกต้องตามหลักไวยากรณ์และบริบทการใช้งาน',
  },
  {
    title: 'นักวิเคราะห์ข้อมูลและสรุปประเด็น',
    desc: 'สรุปบทความยาวเป็นประเด็นสำคัญ หัวข้อย่อย Bullet points',
    prompt: 'คุณคือนักวิเคราะห์ข้อมูล ช่วยสรุปประเด็นสำคัญจากข้อความหรือบทความยาวๆ ออกมาเป็นหัวข้อย่อยแบบ Bullet Points พร้อมบทสรุปเชิงลึกที่กระชับและเข้าใจได้ทันที',
  },
];

export const SystemInstructionModal: React.FC<SystemInstructionModalProps> = ({
  isOpen,
  onClose,
  systemInstruction,
  onSave,
}) => {
  const [text, setText] = useState(systemInstruction);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(text.trim());
    onClose();
  };

  const handleReset = () => {
    setText(PRESET_TEMPLATES[0].prompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                คำสั่งระบบ (System Instructions)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                กำหนดบทบาท บุคลิกภาพ และรูปแบบการตอบของ Gemini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Preset Buttons */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
              แม่แบบสำเร็จรูป (Presets):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_TEMPLATES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setText(preset.prompt)}
                  className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-all text-xs"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    {preset.title}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {preset.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              ข้อความคำสั่งระบบ:
            </label>
            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="ระบุคำสั่งที่ต้องการให้ Gemini ปฏิบัติตามในทุกคำตอบ..."
              className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนค่าเริ่มต้น</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-colors"
            >
              บันทึกคำสั่งระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
