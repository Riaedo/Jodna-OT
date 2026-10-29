import React, { useState, useEffect } from 'react';
import { PayrollSettings, ShiftGroup, ShiftPeriod } from '../types/overtime';
import { 
  X, 
  Settings, 
  DollarSign, 
  User, 
  Calendar, 
  ShieldCheck, 
  Gift, 
  Save, 
  RotateCcw,
  Briefcase
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../data/initialData';
import { AVAILABLE_ICONS, renderAppIcon } from './BrandEditModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PayrollSettings;
  onSaveSettings: (newSettings: PayrollSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<PayrollSettings>({ ...settings });

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof PayrollSettings, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  const handleResetToDefault = () => {
    setFormData({ ...DEFAULT_SETTINGS });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">ตั้งค่าฐานเงินเดือน & ระบบกะทำงาน</h3>
              <p className="text-xs text-slate-300">
                ฐานเงินเดือน, สลับกะ 2wk Day/Night, วันหยุดเสาร์ Shift A/B, และรอบตัดวิก
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">
          
          {/* Section 0: Brand & Icon (5: ตรงชื่อและรูปไอคอน กำหนดให้แก้ไขได้) */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                {renderAppIcon(formData.appIcon || 'Calculator', 'w-4 h-4')}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  ชื่อระบบและรูปไอคอน (App Brand & Icon)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  กำหนดชื่อระบบหรือชื่อบริษัท และรูปไอคอนที่แสดงบนหัวเว็บ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ชื่อระบบ / ชื่อบริษัท
                </label>
                <input
                  type="text"
                  value={formData.appName || ''}
                  onChange={(e) => handleChange('appName', e.target.value)}
                  placeholder="เช่น OT PayMaster"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  คำบรรยายย่อย / สโลแกน
                </label>
                <input
                  type="text"
                  value={formData.appSubtitle || ''}
                  onChange={(e) => handleChange('appSubtitle', e.target.value)}
                  placeholder="เช่น ระบบคำนวณโอทีและสลิปเงินเดือน"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                เลือกรูปไอคอน
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {AVAILABLE_ICONS.map((item) => {
                  const isSelected = (formData.appIcon || 'Calculator') === item.id;
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleChange('appIcon', item.id)}
                      title={item.label}
                      className={`p-2 rounded-xl flex flex-col items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 1: Shift Work Settings (1.1, 1.2) */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 p-4 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    ระบบการเข้ากะทำงาน (Shift System)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    เลือกเข้ากะเพื่อเปิดใช้การสลับ Day 2 สัปดาห์ และ Night 2 สัปดาห์อัตโนมัติ
                  </p>
                </div>
              </div>

              {/* Shift Work Toggle: เข้ากะ / ไม่เข้ากะ */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleChange('shiftWorkEnabled', !formData.shiftWorkEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    formData.shiftWorkEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.shiftWorkEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formData.shiftWorkEnabled ? 'เข้ากะ' : 'ไม่เข้ากะ'}
                </span>
              </div>
            </div>

            {/* 1.1: Always allow selecting Shift A / B regardless of shiftWorkEnabled! */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/40">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  เลือกสังกัดกะ (Shift Group) {formData.shiftWorkEnabled ? '' : '(เลือกได้แม้ไม่เข้ากะ)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('shiftGroup', 'A')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      formData.shiftGroup === 'A'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    กะ A (Shift A)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('shiftGroup', 'B')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      formData.shiftGroup === 'B'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    กะ B (Shift B)
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  * กะ A และ กะ B จะสลับหยุดเสาร์เว้นเสาร์กัน
                </span>
              </div>

              {formData.shiftWorkEnabled && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    วันที่อ้างอิงสลับกะ (Reference Date)
                  </label>
                  <input
                    type="date"
                    value={formData.shiftReferenceDate}
                    onChange={(e) => handleChange('shiftReferenceDate', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">เริ่มต้นรอบ 2 สัปดาห์ Day / Night</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Employee Profile & Start Date */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ข้อมูลพนักงาน & วันเริ่มทำงาน
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ชื่อพนักงาน
                </label>
                <input
                  type="text"
                  value={formData.employeeName || ''}
                  onChange={(e) => handleChange('employeeName', e.target.value)}
                  placeholder="กรุณากรอกชื่อ-นามสกุล"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  รหัสพนักงาน
                </label>
                <input
                  type="text"
                  value={formData.employeeId || ''}
                  onChange={(e) => handleChange('employeeId', e.target.value)}
                  placeholder="เช่น EMP-001"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  แผนก / ฝ่าย
                </label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="เช่น ฝ่ายผลิต, คลังสินค้า"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                    วันเริ่มทำงาน (Work Start Date)
                  </label>
                  {formData.workStartDate && (
                    <button
                      type="button"
                      onClick={() => handleChange('workStartDate', '')}
                      className="text-[10px] text-rose-500 hover:text-rose-600 underline font-semibold"
                    >
                      ล้างค่า (เว้นว่าง)
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={formData.workStartDate || ''}
                  onChange={(e) => handleChange('workStartDate', e.target.value)}
                  className="w-full bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 dark:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  {formData.workStartDate ? 'เริ่มบันทึกและคำนวณจากวันนี้' : 'หากเว้นว่างไว้ ระบบจะคืนค่าวันที่/รอบเดือน/รอบปีเป็นว่าง'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Salary & Working Hours */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ฐานเงินเดือน & ตัวหารสูตร
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ฐานเงินเดือน (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.baseSalary > 0 ? formData.baseSalary : ''}
                  placeholder="0.00"
                  onChange={(e) => handleChange('baseSalary', Number(e.target.value) || 0)}
                  className="w-full bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-2 text-sm font-bold text-emerald-800 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">ระบุฐานเงินเดือนหลัก</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  จำนวนวันทำงานต่อเดือน (หาร)
                </label>
                <input
                  type="number"
                  value={formData.daysPerMonth || ''}
                  placeholder="30"
                  onChange={(e) => handleChange('daysPerMonth', Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">มาตรฐาน: 30 วัน</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ชั่วโมงทำงานปกติ/วัน (หาร)
                </label>
                <input
                  type="number"
                  value={formData.hoursPerDay || ''}
                  placeholder="8"
                  onChange={(e) => handleChange('hoursPerDay', Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">มาตรฐาน: 8 ชั่วโมง</span>
              </div>
            </div>
          </div>

          {/* Section 4: Allowances (1.3: เปลี่ยน อื่นๆ เป็น เบี้ยขยัน และ เพิ่ม ค่าเข้ากะ) */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Gift className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              เงินได้สวัสดิการ (Allowances)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ค่าบ้าน (A41)
                </label>
                <input
                  type="number"
                  value={formData.housingAllowance > 0 ? formData.housingAllowance : ''}
                  placeholder="0.00"
                  onChange={(e) => handleChange('housingAllowance', Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ค่ากันดาร (A10)
                </label>
                <input
                  type="number"
                  value={formData.hardshipAllowance > 0 ? formData.hardshipAllowance : ''}
                  placeholder="0.00"
                  onChange={(e) => handleChange('hardshipAllowance', Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* 1.3: เบี้ยขยัน (แทน อื่นๆ) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  เบี้ยขยัน (บาท)
                </label>
                <input
                  type="number"
                  value={formData.diligenceAmount > 0 ? formData.diligenceAmount : ''}
                  placeholder="0.00"
                  onChange={(e) => handleChange('diligenceAmount', Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* 1.3: ค่าเข้ากะ (หากเลือกไม่เข้ากะ ให้บังคับเป็น "-") */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ค่าเข้ากะ (บาท)
                </label>
                {formData.shiftWorkEnabled ? (
                  <input
                    type="number"
                    value={formData.shiftAmount > 0 ? formData.shiftAmount : ''}
                    placeholder="0.00"
                    onChange={(e) => handleChange('shiftAmount', Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                ) : (
                  <input
                    type="text"
                    disabled
                    value="-"
                    className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 text-center cursor-not-allowed"
                  />
                )}
                {!formData.shiftWorkEnabled && (
                  <span className="text-[10px] text-slate-400 block mt-0.5">บังคับ "-" เมื่อไม่เข้ากะ</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Deductions */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <ShieldCheck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              รายการหัก (Deductions)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  หักกองทุนสำรองฯ %
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.providentFundRate > 0 ? (formData.providentFundRate * 100).toFixed(1) : ''}
                  placeholder="0"
                  onChange={(e) => handleChange('providentFundRate', (Number(e.target.value) || 0) / 100)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">ระบุ % กองทุน (เช่น 2)</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  เพดาน ปกส. (บาท)
                </label>
                <input
                  type="number"
                  value={formData.socialSecurityCap > 0 ? formData.socialSecurityCap : ''}
                  placeholder="875"
                  onChange={(e) => handleChange('socialSecurityCap', Number(e.target.value) || 875)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">875 หรือ 750</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  หักอื่นๆ (บาท)
                </label>
                <input
                  type="number"
                  value={formData.otherDeductions > 0 ? formData.otherDeductions : ''}
                  placeholder="0.00"
                  onChange={(e) => handleChange('otherDeductions', Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  ภาษีที่จ่ายไป (บาท)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.taxPaid !== undefined && formData.taxPaid > 0 ? formData.taxPaid : ''}
                  placeholder="0.00"
                  onChange={(e) => handleChange('taxPaid', Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">นำมาหักคำนวณเงินได้สุทธิ</span>
              </div>
            </div>
          </div>

          {/* Section 6: Unified Cutoff System (3: ระบบตัดรอบต่างๆในรอบปี ให้ใช้รอบปีวันเดียวกันทั้งหมด) */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ระบบตัดรอบระบบ (ใช้รอบวันเดียวกันทั้งหมด)
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                Unified Cutoff Day: วันที่ {formData.cycleStartDay}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. วันที่ตัดรอบระบบ (ใช้ร่วมกันทุกระบบ) */}
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    วันที่ตัดรอบหลัก (Unified Cutoff Day)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.cycleStartDay || ''}
                    placeholder="20"
                    onChange={(e) => {
                      const dayVal = Math.max(1, Math.min(31, Number(e.target.value) || 20));
                      const endVal = dayVal === 1 ? 31 : dayVal - 1;
                      setFormData((prev) => ({
                        ...prev,
                        cycleStartDay: dayVal,
                        leaveYearStartDay: dayVal, // ใช้รอบปีวันเดียวกันทั้งหมด
                        cycleEndDay: endVal,
                      }));
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-3 py-2 text-xs font-black text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    * มีผลกับทั้งรอบเงินเดือนและรอบปีวันลา
                  </span>
                </div>

                {/* 2. วันสิ้นสุดรอบเงินเดือน */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    วันสิ้นสุดรอบเงินเดือน
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.cycleEndDay || ''}
                    placeholder="19"
                    onChange={(e) => handleChange('cycleEndDay', Number(e.target.value) || 19)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    (เช่น {formData.cycleStartDay} ถึง {formData.cycleEndDay})
                  </span>
                </div>

                {/* 3. เดือนเริ่มรอบปีวันลา */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    เดือนเริ่มรอบปีวันลา
                  </label>
                  <select
                    value={formData.leaveYearStartMonth || 1}
                    onChange={(e) => handleChange('leaveYearStartMonth', Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="1">มกราคม (เริ่มวันที่ {formData.cycleStartDay})</option>
                    <option value="10">ตุลาคม (เริ่มวันที่ {formData.cycleStartDay})</option>
                    <option value="11">พฤศจิกายน (เริ่มวันที่ {formData.cycleStartDay})</option>
                    <option value="12">ธันวาคม (เริ่มวันที่ {formData.cycleStartDay})</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    รอบปีวันลาตัดวันที่ {formData.cycleStartDay} เดียวกัน
                  </span>
                </div>
              </div>

              {/* Leave Quotas */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2">
                  โควต้าวันลาประจำปี (Annual Leave Quotas)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      โควต้าลาป่วย (E) วัน/ปี
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.leaveSickQuota !== undefined && formData.leaveSickQuota > 0 ? formData.leaveSickQuota : ''}
                      placeholder="30"
                      onChange={(e) => handleChange('leaveSickQuota', Number(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      โควต้าลากิจ (D) วัน/ปี
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.leavePersonalQuota !== undefined && formData.leavePersonalQuota > 0 ? formData.leavePersonalQuota : ''}
                      placeholder="6"
                      onChange={(e) => handleChange('leavePersonalQuota', Number(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      โควต้าลาพักร้อน (J) พื้นฐาน
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.leaveVacationQuota !== undefined && formData.leaveVacationQuota > 0 ? formData.leaveVacationQuota : ''}
                      placeholder="6"
                      onChange={(e) => handleChange('leaveVacationQuota', Number(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-xl px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-300"
                    />
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 mt-1 block">
                      * สามารถปรับสิทธิ์แบบปีต่อปีได้ในแท็บ "บันทึกการลา"
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary note */}
              <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-2.5 text-[11px] text-indigo-900 dark:text-indigo-300">
                💡 <strong>รอบที่ใช้งานปัจจุบัน:</strong> เงินเดือนตัดรอบทุกวันที่ <strong>{formData.cycleStartDay} ถึง {formData.cycleEndDay}</strong> ของทุกเดือน และรอบสถิติการลาประจำปีจะเริ่มต้นวันที่ <strong>{formData.cycleStartDay}</strong> ในเดือนที่เลือกไว้
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              คืนค่าเริ่มต้น
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 active:scale-95 transition-all"
              >
                <Save className="w-4 h-4" />
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
