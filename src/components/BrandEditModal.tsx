import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Calculator, 
  Briefcase, 
  Clock, 
  Building2, 
  Factory, 
  Coins, 
  Sparkles, 
  UserCheck, 
  CalendarCheck, 
  Flame,
  Smile
} from 'lucide-react';

interface BrandEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  appIcon: string;
  appSubtitle: string;
  onSave: (newName: string, newIcon: string, newSubtitle: string) => void;
}

export const AVAILABLE_ICONS = [
  { id: 'Calculator', label: 'เครื่องคิดเลข', icon: Calculator },
  { id: 'Briefcase', label: 'กระเป๋าทำงาน', icon: Briefcase },
  { id: 'Clock', label: 'เวลา / โอที', icon: Clock },
  { id: 'Building2', label: 'บริษัท / องค์กร', icon: Building2 },
  { id: 'Factory', label: 'โรงงาน / กะผลิต', icon: Factory },
  { id: 'Coins', label: 'รายได้ / เงินเดือน', icon: Coins },
  { id: 'Sparkles', label: 'พรีเมียม', icon: Sparkles },
  { id: 'UserCheck', label: 'พนักงาน', icon: UserCheck },
  { id: 'CalendarCheck', label: 'ปฏิทินกะ', icon: CalendarCheck },
  { id: 'Flame', label: 'โอทีไฟแรง', icon: Flame },
];

export const renderAppIcon = (iconId: string, className = 'w-5 h-5') => {
  const found = AVAILABLE_ICONS.find((item) => item.id === iconId);
  if (found) {
    const IconComp = found.icon;
    return <IconComp className={className} />;
  }
  return <Calculator className={className} />;
};

export const BrandEditModal: React.FC<BrandEditModalProps> = ({
  isOpen,
  onClose,
  appName,
  appIcon,
  appSubtitle,
  onSave,
}) => {
  const [name, setName] = useState(appName || '');
  const [icon, setIcon] = useState(appIcon || 'Calculator');
  const [subtitle, setSubtitle] = useState(appSubtitle || '');

  useEffect(() => {
    if (isOpen) {
      setName(appName || '');
      setIcon(appIcon || 'Calculator');
      setSubtitle(appSubtitle || '');
    }
  }, [isOpen, appName, appIcon, appSubtitle]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), icon, subtitle.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              {renderAppIcon(icon, 'w-5 h-5')}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">
                แก้ไขชื่อระบบและรูปไอคอน
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                กำหนดชื่อแอปพลิเคชันหรือชื่อบริษัท และเลือกไอคอนตามต้องการ
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          
          {/* App Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ชื่อระบบ / ชื่อบริษัท (App / Company Name)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น OT PayMaster, บจก. สยาม ออโต้"
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Subtitle Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              คำบรรยายย่อย / แผนก (Subtitle)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="เช่น ระบบคำนวณโอทีและสลิปเงินเดือน"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Icon Selector Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              เลือกรูปไอคอน (Icon)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {AVAILABLE_ICONS.map((item) => {
                const isSelected = icon === item.id;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    title={item.label}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 scale-105'
                        : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <IconComponent className="w-5 h-5 mb-1" />
                    <span className="text-[9px] font-medium truncate w-full text-center">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              ตัวอย่างการแสดงผลบนแถบเมนู:
            </span>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                {renderAppIcon(icon, 'w-4 h-4')}
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white block">
                  {name || 'ชื่อระบบ'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {subtitle || 'คำบรรยาย'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>บันทึกการเปลี่ยนแปลง</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
