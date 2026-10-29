import React, { useState, useEffect } from 'react';
import { DailyRecord, PayrollSettings, PayrollSummary, ShiftType, ShiftPeriod } from '../types/overtime';
import { formatCurrency } from '../utils/calculator';
import { 
  X, 
  Clock, 
  Trash2, 
  Save, 
  AlertCircle,
  Sun,
  Moon
} from 'lucide-react';

interface RecordModalProps {
  record: DailyRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecord: DailyRecord) => void;
  summary: PayrollSummary;
  settings: PayrollSettings;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  record,
  isOpen,
  onClose,
  onSave,
  summary,
  settings,
}) => {
  const [shiftType, setShiftType] = useState<ShiftType>(record?.shiftType || 'NORMAL');
  const [shiftPeriod, setShiftPeriod] = useState<ShiftPeriod>(record?.shiftPeriod || 'DAY');
  const [ot1_5, setOt1_5] = useState<number>(record?.ot1_5 || 0);
  const [ot1_0, setOt1_0] = useState<number>(record?.ot1_0 || 0);
  const [ot2_0, setOt2_0] = useState<number>(record?.ot2_0 || 0);
  const [ot3_0, setOt3_0] = useState<number>(record?.ot3_0 || 0);
  const [note, setNote] = useState<string>(record?.note || '');

  useEffect(() => {
    if (record) {
      setShiftType(record.shiftType);
      setShiftPeriod(record.shiftPeriod || 'DAY');
      setOt1_5(record.ot1_5 || 0);
      setOt1_0(record.ot1_0 || 0);
      setOt2_0(record.ot2_0 || 0);
      setOt3_0(record.ot3_0 || 0);
      setNote(record.note || '');
    }
  }, [record]);

  if (!isOpen || !record) return null;

  // Live total earnings for this day
  const todayOtPay = 
    (ot1_0 * summary.ot1_0_rate) +
    (ot1_5 * summary.ot1_5_rate) +
    (ot2_0 * summary.ot2_0_rate) +
    (ot3_0 * summary.ot3_0_rate);

  const totalHours = ot1_0 + ot1_5 + ot2_0 + ot3_0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...record,
      shiftType,
      shiftPeriod,
      ot1_5: Number(ot1_5) || 0,
      ot1_0: Number(ot1_0) || 0,
      ot2_0: Number(ot2_0) || 0,
      ot3_0: Number(ot3_0) || 0,
      note,
      isBeforeWorkStart: false,
    });
    onClose();
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearDay = () => {
    setOt1_5(0);
    setOt1_0(0);
    setOt2_0(0);
    setOt3_0(0);
    setNote('');
  };

  const handleExecuteClearAndSave = () => {
    onSave({
      ...record,
      shiftType: 'NORMAL',
      ot1_5: 0,
      ot1_0: 0,
      ot2_0: 0,
      ot3_0: 0,
      note: '',
      isBeforeWorkStart: false,
    });
    setShowClearConfirm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                <Clock className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                บันทึกเวลาทำงาน & โอที
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold mt-1">
              {(() => {
                const dayIdx = new Date(record.date + 'T00:00:00').getDay();
                const thaiDaysFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
                return `${thaiDaysFull[dayIdx]}ที่ ${record.dayNumber} (${record.date})`;
              })()}
            </h3>
            {record.holidayName && (
              <span className="text-xs text-amber-300 font-medium block mt-0.5">
                ★ {record.holidayName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5">
          
          {/* Before work start notice */}
          {record.isBeforeWorkStart && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="block font-bold">วันที่นี้อยู่ก่อนวันเริ่มทำงาน</strong>
                <span>วันเริ่มทำงานที่กำหนดไว้คือ <strong>{settings.workStartDate || '-'}</strong> หากมีการบันทึกเวลาทำงานในวันนี้ ระบบจะบันทึกข้อมูลและคำนวณให้ตามปกติ</span>
              </div>
            </div>
          )}

          {/* Day / Night Shift Selector (If shift work enabled) */}
          {settings.shiftWorkEnabled && (
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                ช่วงเวลากะทำงาน (Shift Period) - กะ {settings.shiftGroup}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShiftPeriod('DAY')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                    shiftPeriod === 'DAY'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>กะเช้า (Day Shift)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShiftPeriod('NIGHT')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                    shiftPeriod === 'NIGHT'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>กะดึก (Night Shift)</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. Shift Type Selection: Normal, H, E (ลาป่วย), D (ลากิจ), J (ลาพักร้อน) */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
              สถานะกะ / การมาทำงาน
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setShiftType('NORMAL')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  shiftType === 'NORMAL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                ปกติ (ทำงาน)
              </button>

              <button
                type="button"
                onClick={() => setShiftType('H')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  shiftType === 'H'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                หยุด (H)
              </button>

              <button
                type="button"
                onClick={() => setShiftType('E')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  shiftType === 'E'
                    ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                ลาป่วย (E)
              </button>

              <button
                type="button"
                onClick={() => setShiftType('D')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  shiftType === 'D'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                }`}
              >
                ลากิจ (D)
              </button>

              <button
                type="button"
                onClick={() => setShiftType('J')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  shiftType === 'J'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                }`}
              >
                ลาพักร้อน (J)
              </button>
            </div>
            {(shiftType === 'E' || shiftType === 'D' || shiftType === 'J') && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                สถานะการลาจะถูกบันทึกสะสมในรายงานสถิติการลารายปี
              </p>
            )}
          </div>

          {/* 7 & 8: Preset buttons and time duration calculator removed! Direct OT hours inputs: */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 block mb-1">
                OT * 1.5 (วันปกติ)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={ot1_5 || ''}
                  placeholder="0"
                  onChange={(e) => setOt1_5(Number(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400">ชม.</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                = ฿{formatCurrency(ot1_5 * summary.ot1_5_rate)}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-blue-800 dark:text-blue-400 block mb-1">
                OT * 1.0 (วันหยุด)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={ot1_0 || ''}
                  placeholder="0"
                  onChange={(e) => setOt1_0(Number(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400">ชม.</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                = ฿{formatCurrency(ot1_0 * summary.ot1_0_rate)}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-purple-800 dark:text-purple-400 block mb-1">
                OT * 3.0 (ล่วงเวลาหยุด)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={ot3_0 || ''}
                  placeholder="0"
                  onChange={(e) => setOt3_0(Number(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400">ชม.</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                = ฿{formatCurrency(ot3_0 * summary.ot3_0_rate)}
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
              หมายเหตุ / งานที่ปฏิบัติ
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ทำงานล่วงเวลาฝ่ายผลิต, ซ่อมบำรุงไลน์..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Payout Preview */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-indigo-950/40 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-600 dark:text-slate-300 block">
                รวมชั่วโมง OT วันนี้: <strong className="text-slate-800 dark:text-white">{totalHours} ชม.</strong>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                ค่าล่วงเวลาเฉพาะของวันนี้
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                +฿{formatCurrency(todayOtPay)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {showClearConfirm ? (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 p-1.5 sm:p-2 rounded-xl border border-rose-200 dark:border-rose-900/60 animate-in fade-in">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">ลบข้อมูล OT และบันทึกทันที?</span>
                <button
                  type="button"
                  onClick={handleExecuteClearAndSave}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
                >
                  ยืนยันลบ
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors border border-rose-200/80 dark:border-rose-900/60"
                  title="ลบข้อมูล OT และหมายเหตุของวันนี้ทั้งหมด พร้อมบันทึกทันที"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>ลบข้อมูลวันนี้</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearDay}
                  className="px-2.5 py-1.5 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="รีเซ็ตเฉพาะช่องกรอกให้เป็น 0 โดยยังไม่บันทึก"
                >
                  รีเซ็ตช่องกรอก
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
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
                บันทึก
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
