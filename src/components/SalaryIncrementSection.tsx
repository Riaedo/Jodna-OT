import React, { useState, useMemo, useEffect } from 'react';
import { SalaryIncrementRecord, PayrollSettings } from '../types/overtime';
import { DEFAULT_SALARY_INCREMENTS } from '../data/initialSalaryIncrements';
import { formatCurrency, formatYearMonthThai } from '../utils/calculator';
import { 
  TrendingUp, 
  Plus, 
  Pencil, 
  Trash2, 
  RotateCcw, 
  Check, 
  X, 
  DollarSign, 
  Percent, 
  ShieldCheck, 
  Sparkles,
  ArrowUpRight,
  Info,
  Calendar,
  Layers,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface SalaryIncrementSectionProps {
  salaryIncrements?: SalaryIncrementRecord[];
  onUpdateSalaryIncrements?: (records: SalaryIncrementRecord[]) => void;
  settings: PayrollSettings;
  onUpdateBaseSalary?: (newSalary: number) => void;
}

export const SalaryIncrementSection: React.FC<SalaryIncrementSectionProps> = ({
  salaryIncrements: propIncrements,
  onUpdateSalaryIncrements,
  settings,
  onUpdateBaseSalary,
}) => {
  // Local state fallback if prop not provided (v2: ว่างเริ่มต้น พร้อมใช้งานจริง)
  const [localRecords, setLocalRecords] = useState<SalaryIncrementRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ot_app_salary_increments_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item, idx) => ({
            ...item,
            effectiveMonth: item.effectiveMonth || `${item.effectiveYear || (2022 + (item.tenureYear ?? idx))}-10`,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SALARY_INCREMENTS;
  });

  const records = propIncrements || localRecords;

  const updateRecords = (newRecords: SalaryIncrementRecord[]) => {
    if (onUpdateSalaryIncrements) {
      onUpdateSalaryIncrements(newRecords);
    } else {
      setLocalRecords(newRecords);
    }
    try {
      localStorage.setItem('ot_app_salary_increments_v2', JSON.stringify(newRecords));
    } catch (e) {
      console.error(e);
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryIncrementRecord | null>(null);

  // Form inputs
  const [formTenureYear, setFormTenureYear] = useState<number>(0);
  const [formEffectiveMonth, setFormEffectiveMonth] = useState<string>('');
  const [formSalaryBefore, setFormSalaryBefore] = useState<number>(0);
  const [formIncreasePercent, setFormIncreasePercent] = useState<number>(0);
  const [formNote, setFormNote] = useState<string>('');
  const [formApplyAsBaseSalary, setFormApplyAsBaseSalary] = useState<boolean>(true);
  const [calcMode, setCalcMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [formIncreaseAmountDirect, setFormIncreaseAmountDirect] = useState<number>(0);

  // Toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // In-UI Confirmation Modals (no window.confirm in iframe)
  const [deletingRecord, setDeletingRecord] = useState<SalaryIncrementRecord | null>(null);
  const [isResetTemplateModalOpen, setIsResetTemplateModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Sorted records by effectiveMonth / tenureYear
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const aMonth = a.effectiveMonth || `${a.effectiveYear || (2022 + a.tenureYear)}-10`;
      const bMonth = b.effectiveMonth || `${b.effectiveYear || (2022 + b.tenureYear)}-10`;
      if (aMonth !== bMonth) return aMonth.localeCompare(bMonth);
      return a.tenureYear - b.tenureYear;
    });
  }, [records]);

  // Derived metrics
  const startingRecord = sortedRecords[0];
  const latestRecord = sortedRecords[sortedRecords.length - 1];

  const startingSalary = startingRecord ? startingRecord.salaryBefore : (settings.baseSalary || 0);
  const currentSalary = latestRecord ? latestRecord.salaryAfter : (settings.baseSalary || 0);
  const totalIncreaseAmount = latestRecord ? (currentSalary - startingSalary) : 0;
  const totalIncreasePercent = latestRecord && startingSalary > 0 ? (totalIncreaseAmount / startingSalary) * 100 : 0;
  const latestPfDeduction = latestRecord ? latestRecord.providentFundDeduction : Math.round(currentSalary * (settings.providentFundRate || 0));

  // Average annual growth rate (excluding Year 0)
  const adjustedRecords = sortedRecords.filter((r) => r.tenureYear > 0);
  const avgIncreasePercent = adjustedRecords.length > 0 
    ? adjustedRecords.reduce((acc, r) => acc + r.increasePercent, 0) / adjustedRecords.length
    : 0;

  // Open Modal for Add
  const handleOpenAdd = () => {
    const hasExisting = sortedRecords.length > 0;
    const nextYear = hasExisting ? Math.max(...sortedRecords.map((r) => r.tenureYear)) + 1 : 0;
    const prevSalary = latestRecord ? latestRecord.salaryAfter : (settings.baseSalary || 0);
    
    // Determine next effective month: +1 year from previous record or from work start date
    let nextMonthStr = '';
    if (latestRecord && latestRecord.effectiveMonth) {
      const parts = latestRecord.effectiveMonth.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10) + 1;
        nextMonthStr = `${y}-${parts[1]}`;
      }
    } else if (settings.workStartDate) {
      nextMonthStr = settings.workStartDate.substring(0, 7);
    } else {
      const now = new Date();
      nextMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    setEditingRecord(null);
    setFormTenureYear(nextYear);
    setFormEffectiveMonth(nextMonthStr);
    setFormSalaryBefore(prevSalary);
    const defaultPercent = hasExisting ? 3.5 : 0;
    setFormIncreasePercent(defaultPercent);
    setCalcMode('PERCENT');
    const incAmt = Math.round(prevSalary * (defaultPercent / 100));
    setFormIncreaseAmountDirect(incAmt);
    setFormNote(hasExisting ? `ปรับเงินเดือนประจำปีที่ ${nextYear} (+3.5%)` : 'เริ่มต้นเข้าทำงาน');
    setFormApplyAsBaseSalary(true);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (rec: SalaryIncrementRecord) => {
    setEditingRecord(rec);
    setFormTenureYear(rec.tenureYear);
    setFormEffectiveMonth(rec.effectiveMonth || `${rec.effectiveYear || (2022 + rec.tenureYear)}-10`);
    setFormSalaryBefore(rec.salaryBefore);
    setFormIncreasePercent(rec.increasePercent);
    setFormIncreaseAmountDirect(rec.increaseAmount);
    setCalcMode('PERCENT');
    setFormNote(rec.note || '');
    setFormApplyAsBaseSalary(false);
    setIsModalOpen(true);
  };

  // Open In-UI delete confirmation
  const handleOpenDeleteConfirm = (rec: SalaryIncrementRecord) => {
    setDeletingRecord(rec);
  };

  // Execute deletion confirmed by user
  const handleConfirmDelete = () => {
    if (!deletingRecord) return;
    const targetId = deletingRecord.id;
    const updated = records.filter((r) => r.id !== targetId);
    updateRecords(updated);
    if (editingRecord && editingRecord.id === targetId) {
      setIsModalOpen(false);
      setEditingRecord(null);
    }
    setDeletingRecord(null);
    showToast('ลบรายการปรับเงินเดือนเรียบร้อยแล้ว');
  };

  // Quick Auto-add next year (+3.5%)
  const handleQuickAddNextYear = () => {
    const hasExisting = sortedRecords.length > 0;
    const nextYear = hasExisting ? Math.max(...sortedRecords.map((r) => r.tenureYear)) + 1 : 0;
    const prevSalary = latestRecord ? latestRecord.salaryAfter : (settings.baseSalary || 0);
    const percent = hasExisting ? 3.5 : 0;
    const incAmount = Math.round(prevSalary * (percent / 100));
    const newSalary = prevSalary + incAmount;
    const pfDeduct = Math.round(newSalary * (settings.providentFundRate || 0));

    let nextMonthStr = '';
    if (latestRecord && latestRecord.effectiveMonth) {
      const parts = latestRecord.effectiveMonth.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10) + 1;
        nextMonthStr = `${y}-${parts[1]}`;
      }
    } else if (settings.workStartDate) {
      nextMonthStr = settings.workStartDate.substring(0, 7);
    } else {
      const now = new Date();
      nextMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const newRecord: SalaryIncrementRecord = {
      id: `inc-${Date.now()}`,
      tenureYear: nextYear,
      effectiveMonth: nextMonthStr,
      salaryBefore: prevSalary,
      increasePercent: percent,
      salaryAfter: newSalary,
      increaseAmount: incAmount,
      providentFundDeduction: pfDeduct,
      note: hasExisting ? `ปรับเงินเดือนประจำปีที่ ${nextYear} (+3.5%)` : 'เริ่มต้นเข้าทำงาน',
      effectiveYear: parseInt(nextMonthStr.split('-')[0], 10) || new Date().getFullYear(),
    };

    const updated = [...records, newRecord];
    updateRecords(updated);
    if (onUpdateBaseSalary) {
      onUpdateBaseSalary(newSalary);
    }
    showToast(`เพิ่มการปรับเงินเดือนปีที่ ${nextYear} (มีผล ${formatYearMonthThai(nextMonthStr)}) สำเร็จ`);
  };

  // In-UI Reset to default template (ล้างข้อมูลให้เป็นค่าว่าง)
  const handleOpenResetTemplateConfirm = () => {
    setIsResetTemplateModalOpen(true);
  };

  const handleConfirmResetTemplate = () => {
    updateRecords([]);
    setIsResetTemplateModalOpen(false);
    showToast('ล้างข้อมูลการปรับเงินเดือนเป็นค่าว่างแล้ว');
  };

  // Save Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();

    let computedIncreaseAmount = 0;
    let computedPercent = 0;
    let computedSalaryAfter = 0;

    if (calcMode === 'PERCENT') {
      computedPercent = Number(formIncreasePercent) || 0;
      computedIncreaseAmount = Math.round(formSalaryBefore * (computedPercent / 100));
      computedSalaryAfter = formSalaryBefore + computedIncreaseAmount;
    } else {
      computedIncreaseAmount = Number(formIncreaseAmountDirect) || 0;
      computedSalaryAfter = formSalaryBefore + computedIncreaseAmount;
      computedPercent = formSalaryBefore > 0 ? (computedIncreaseAmount / formSalaryBefore) * 100 : 0;
    }

    const pfRate = settings.providentFundRate || 0.02;
    const computedPf = Math.round(computedSalaryAfter * pfRate);
    const effYear = parseInt(formEffectiveMonth.split('-')[0], 10) || 2026;

    if (editingRecord) {
      // Edit existing
      const updated = records.map((r) =>
        r.id === editingRecord.id
          ? {
              ...r,
              tenureYear: formTenureYear,
              effectiveMonth: formEffectiveMonth,
              salaryBefore: formSalaryBefore,
              increasePercent: Number(computedPercent.toFixed(2)),
              salaryAfter: computedSalaryAfter,
              increaseAmount: computedIncreaseAmount,
              providentFundDeduction: computedPf,
              note: formNote,
              effectiveYear: effYear,
            }
          : r
      );
      updateRecords(updated);
      showToast(`บันทึกการแก้ไขปีที่ ${formTenureYear} (มีผล ${formatYearMonthThai(formEffectiveMonth)}) สำเร็จ`);
    } else {
      // Add new
      const newRec: SalaryIncrementRecord = {
        id: `inc-${Date.now()}`,
        tenureYear: formTenureYear,
        effectiveMonth: formEffectiveMonth,
        salaryBefore: formSalaryBefore,
        increasePercent: Number(computedPercent.toFixed(2)),
        salaryAfter: computedSalaryAfter,
        increaseAmount: computedIncreaseAmount,
        providentFundDeduction: computedPf,
        note: formNote || `ปรับเงินเดือนปีที่ ${formTenureYear}`,
        effectiveYear: effYear,
      };
      const updated = [...records, newRec];
      updateRecords(updated);
      showToast(`เพิ่มการปรับเงินเดือนปีที่ ${formTenureYear} (มีผล ${formatYearMonthThai(formEffectiveMonth)}) สำเร็จ`);
    }

    if (formApplyAsBaseSalary && onUpdateBaseSalary) {
      onUpdateBaseSalary(computedSalaryAfter);
    }

    setIsModalOpen(false);
  };

  // Calculate live preview in modal
  const modalPreview = useMemo(() => {
    let incAmt = 0;
    let pct = 0;
    let after = 0;
    if (calcMode === 'PERCENT') {
      pct = Number(formIncreasePercent) || 0;
      incAmt = Math.round(formSalaryBefore * (pct / 100));
      after = formSalaryBefore + incAmt;
    } else {
      incAmt = Number(formIncreaseAmountDirect) || 0;
      after = formSalaryBefore + incAmt;
      pct = formSalaryBefore > 0 ? (incAmt / formSalaryBefore) * 100 : 0;
    }
    const pf = Math.round(after * (settings.providentFundRate || 0.02));
    return {
      incAmt,
      pct,
      after,
      pf,
    };
  }, [formSalaryBefore, formIncreasePercent, formIncreaseAmountDirect, calcMode, settings.providentFundRate]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6 transition-colors">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 dark:border-slate-300 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  ระบบบันทึกการเพิ่มของเงินเดือน (Salary Increment)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  ปรับฐานเงินเดือนตามช่วงเดือนอัตโนมัติ
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ระบุเดือนปีที่ปรับเพิ่มเงินเดือน ระบบจะนำไปคำนวณเป็นฐานเงินเดือนในแต่ละช่วงเดือนย้อนหลังและล่วงหน้าให้อัตโนมัติ
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleQuickAddNextYear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all active:scale-95"
            title="เพิ่มการปรับเงินเดือนปีถัดไปอัตโนมัติ (+3.5%)"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>+ เพิ่มปีถัดไป (+3.5%)</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มรายการใหม่</span>
          </button>

          <button
            onClick={handleOpenResetTemplateConfirm}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title="รีเซ็ตเป็นตารางค่าเริ่มต้น (ปี 0 - 4)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feature Highlight Pill Notice */}
      <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
        <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold">ระบบคำนวณฐานเงินเดือนตามช่วงเดือนอัตโนมัติ (Dynamic Base Salary):</span>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
            เมื่อคุณเปิดดูรอบวิกในอดีตหรืออนาคต ระบบจะดึงฐานเงินเดือนที่มีผลในช่วงเดือนนั้นๆ ไปคำนวณอัตราโอที (OT 1.0x, 1.5x, 3.0x), เงินได้รวม และยอดหักกองทุนของแต่ละรอบเดือนให้อัตโนมัติอย่างถูกต้อง
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Current Salary */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/40 dark:via-slate-900 dark:to-transparent border border-emerald-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <span>ฐานเงินเดือนล่าสุด</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono">
              ปีที่ {latestRecord ? latestRecord.tenureYear : 4}
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums font-mono">
            ฿{formatCurrency(currentSalary)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>มีผลตั้งแต่ {formatYearMonthThai(latestRecord?.effectiveMonth || '2026-10')}</span>
          </div>
        </div>

        {/* Starting Salary */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>เงินเดือนแรกเข้า</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
              ปีที่ 0
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums font-mono">
            ฿{formatCurrency(startingSalary)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            เริ่มต้นเมื่อ {formatYearMonthThai(startingRecord?.effectiveMonth || '2022-10')}
          </div>
        </div>

        {/* Growth Percentage */}
        <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/40 dark:via-slate-900 dark:to-transparent border border-indigo-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-400">
            <span>ความเติบโตสะสม</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
              {adjustedRecords.length} ครั้ง
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums font-mono">
            +{totalIncreasePercent.toFixed(2)}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            ปรับขึ้นเฉลี่ย {avgIncreasePercent.toFixed(2)}% ต่อปี
          </div>
        </div>

        {/* Provident Fund Deduction */}
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/40 dark:via-slate-900 dark:to-transparent border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
            <span>กองทุนที่หักสะสม</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
              2% ต่อเดือน
            </span>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums font-mono">
            ฿{formatCurrency(latestPfDeduction)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            คิดเป็น ฿{formatCurrency(latestPfDeduction * 12)} / ปี
          </div>
        </div>

      </div>

      {/* Visual Step-by-Step Growth Progression Ladder */}
      <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-500" />
            เส้นทางการเติบโตของเงินเดือนตามช่วงเวลา (Timeline Growth Ladder)
          </span>
          <span className="text-[11px] text-slate-400">
            ฐานปัจจุบัน: ฿{formatCurrency(settings.baseSalary)}
          </span>
        </div>

        {sortedRecords.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            ยังไม่มีรายการประวัติการปรับเงินเดือน คลิก <strong>"เพิ่มบันทึกเงินเดือน"</strong> เพื่อเริ่มบันทึก
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            {sortedRecords.map((rec, idx) => {
              const isLatest = idx === sortedRecords.length - 1;
              const monthLabel = rec.effectiveMonth || `${rec.effectiveYear || (2022 + rec.tenureYear)}-10`;
              return (
                <div
                  key={rec.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isLatest
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isLatest
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      ปีที่ {rec.tenureYear}
                    </span>
                    {rec.increasePercent > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        +{rec.increasePercent.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        ตั้งต้น
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    <span>{formatYearMonthThai(monthLabel)}</span>
                  </div>

                  <div className="mt-1 text-sm sm:text-base font-extrabold text-slate-800 dark:text-white tabular-nums font-mono">
                    ฿{formatCurrency(rec.salaryAfter)}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                    <span>เพิ่ม:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {rec.increaseAmount > 0 ? `+฿${formatCurrency(rec.increaseAmount)}` : '-'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Salary Increment Table (Enhanced with เดือนปีที่ปรับ column) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-slate-200/80 dark:from-slate-800 dark:to-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-300 dark:border-slate-700">
                <th className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
                  ปีที่ทำงาน
                </th>
                <th className="py-3.5 px-3 sm:px-4 text-left whitespace-nowrap">
                  เดือนปีที่ปรับ (Effective Date)
                </th>
                <th className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                  เงินเดือนก่อนปรับ
                </th>
                <th className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
                  เปอร์เซนต์ปรับ
                </th>
                <th className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                  เงินเดือนหลังปรับ
                </th>
                <th className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                  เงินเดือนที่เพิ่ม
                </th>
                <th className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                  กองทุนที่หัก
                </th>
                <th className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
                  จัดการ
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    ยังไม่มีรายการบันทึกการปรับเงินเดือน คลิก <strong>"เพิ่มบันทึก"</strong> ด้านบนเพื่อเริ่มบันทึก
                  </td>
                </tr>
              ) : (
                sortedRecords.map((rec, index) => {
                const isLatest = index === sortedRecords.length - 1;
                const effMonth = rec.effectiveMonth || `${rec.effectiveYear || (2022 + rec.tenureYear)}-10`;
                return (
                  <tr
                    key={rec.id}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                      isLatest ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                    }`}
                  >
                    {/* 1. ปีที่ทำงาน */}
                    <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                          {rec.tenureYear}
                        </span>
                        {isLatest && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold whitespace-nowrap">
                            ปัจจุบัน
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. เดือนปีที่ปรับ (Effective Date) */}
                    <td className="py-3 px-3 sm:px-4 text-left whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          <Calendar className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <span className="font-bold block text-slate-800 dark:text-slate-100 text-xs">
                            {formatYearMonthThai(effMonth)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            มีผลตั้งแต่ {effMonth}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. เงินเดือนก่อนปรับ */}
                    <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      ฿{formatCurrency(rec.salaryBefore)}
                    </td>

                    {/* 4. เปอร์เซนต์ปรับ */}
                    <td className="py-3 px-3 sm:px-4 text-center tabular-nums font-mono font-bold">
                      {rec.increasePercent > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {rec.increasePercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          0.00%
                        </span>
                      )}
                    </td>

                    {/* 5. เงินเดือนหลังปรับ */}
                    <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      ฿{formatCurrency(rec.salaryAfter)}
                    </td>

                    {/* 6. เงินเดือนที่เพิ่ม */}
                    <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono">
                      {rec.increaseAmount > 0 ? (
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          +฿{formatCurrency(rec.increaseAmount)}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* 7. กองทุนที่หัก */}
                    <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono font-semibold text-amber-600 dark:text-amber-400">
                      ฿{formatCurrency(rec.providentFundDeduction)}
                    </td>

                    {/* 8. จัดการ */}
                    <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {onUpdateBaseSalary && rec.salaryAfter !== settings.baseSalary && (
                          <button
                            onClick={() => {
                              onUpdateBaseSalary(rec.salaryAfter);
                              showToast(`ใช้เงินเดือนปีที่ ${rec.tenureYear} (฿${formatCurrency(rec.salaryAfter)}) เป็นฐานเงินเดือนแล้ว`);
                            }}
                            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold transition-all"
                            title="นำยอดนี้ไปใช้เป็นฐานเงินเดือนหลักของระบบ"
                          >
                            ใช้เป็นฐาน
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-colors"
                          title="แก้ไขรายการนี้"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {sortedRecords.length > 1 && (
                          <button
                            onClick={() => handleOpenDeleteConfirm(rec)}
                            className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>

            {/* Table Footer with Grand Total */}
            <tfoot>
              <tr className="bg-slate-100 dark:bg-slate-800/90 font-extrabold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 text-xs sm:text-sm">
                <td className="py-3 px-3 sm:px-4 text-center">
                  รวมการปรับเงินเดือน
                </td>
                <td className="py-3 px-3 sm:px-4 text-slate-500 text-[11px]">
                  ทั้งหมด {sortedRecords.length} ช่วง
                </td>
                <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono text-slate-500">
                  -
                </td>
                <td className="py-3 px-3 sm:px-4 text-center tabular-nums font-mono text-indigo-600 dark:text-indigo-400">
                  +{totalIncreasePercent.toFixed(2)}%
                </td>
                <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono text-emerald-600 dark:text-emerald-400">
                  ฿{formatCurrency(currentSalary)}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono text-emerald-600 dark:text-emerald-400">
                  +฿{formatCurrency(totalIncreaseAmount)}
                </td>
                <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono text-amber-600 dark:text-amber-400">
                  ฿{formatCurrency(latestPfDeduction)}
                </td>
                <td className="py-3 px-3 sm:px-4 text-center text-[10px] text-slate-400">
                  (อัตรา 2%)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footnote Explanation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-500 dark:text-slate-400 text-[11px] pt-1">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>
            หมายเหตุ: กองทุนที่หักคำนวณจากอัตรากองทุนสำรองเลี้ยงชีพของบริษัท <strong>{(settings.providentFundRate * 100).toFixed(0)}%</strong> ของเงินเดือนหลังปรับ
          </span>
        </div>
        <div className="text-slate-400">
          อ้างอิงข้อมูล: ฐานเงินเดือนปัจจุบัน <strong>฿{formatCurrency(settings.baseSalary)}</strong>
        </div>
      </div>

      {/* Add / Edit Salary Increment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingRecord ? `แก้ไขการปรับเงินเดือนปีที่ ${formTenureYear}` : 'เพิ่มบันทึกการปรับเงินเดือน'}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    กำหนดเดือนปีที่เริ่มปรับและคำนวณอัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-5 space-y-4 overflow-y-auto">
              
              {/* Tenure Year & Effective Month Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ปีที่ทำงาน (Tenure Year)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    required
                    value={formTenureYear !== undefined && formTenureYear !== null ? formTenureYear : ''}
                    placeholder="0"
                    onChange={(e) => setFormTenureYear(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    เดือนปีที่ปรับ (Effective)
                  </label>
                  <input
                    type="month"
                    required
                    value={formEffectiveMonth}
                    onChange={(e) => setFormEffectiveMonth(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Effective Month Thai Display helper */}
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">รอบเดือนที่มีผล:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formEffectiveMonth ? `${formatYearMonthThai(formEffectiveMonth)} เป็นต้นไป` : 'กรุณาระบุเดือนปีที่เริ่มปรับ'}
                </span>
              </div>

              {/* Salary Before Adjustment */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  เงินเดือนก่อนปรับ (บาท)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={formSalaryBefore > 0 ? formSalaryBefore : ''}
                  placeholder="0.00"
                  onChange={(e) => setFormSalaryBefore(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* Mode Toggle: Percent or Direct Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    รูปแบบการปรับขึ้น
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCalcMode('PERCENT')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                        calcMode === 'PERCENT'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      ระบุเป็น %
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcMode('AMOUNT')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                        calcMode === 'AMOUNT'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      ระบุเป็นบาท
                    </button>
                  </div>
                </div>

                {calcMode === 'PERCENT' ? (
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formIncreasePercent > 0 ? formIncreasePercent : ''}
                      onChange={(e) => setFormIncreasePercent(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formIncreaseAmountDirect > 0 ? formIncreaseAmountDirect : ''}
                      onChange={(e) => setFormIncreaseAmountDirect(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                      บาท
                    </span>
                  </div>
                )}
              </div>

              {/* Live Preview Box */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center justify-between">
                  <span>ผลลัพธ์การคำนวณ (Live Preview)</span>
                  <span className="font-mono">ปีที่ {formTenureYear}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">เงินเดือนใหม่</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      ฿{formatCurrency(modalPreview.after)}
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">เพิ่มขึ้น</div>
                    <div className="font-bold text-slate-800 dark:text-white font-mono mt-0.5">
                      +฿{formatCurrency(modalPreview.incAmt)}
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">หักกองทุน 2%</div>
                    <div className="font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                      ฿{formatCurrency(modalPreview.pf)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  หมายเหตุ (Note)
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="เช่น ปรับประจำปี, เลื่อนตำแหน่ง..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Checkbox Apply as base salary */}
              {onUpdateBaseSalary && (
                <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formApplyAsBaseSalary}
                    onChange={(e) => setFormApplyAsBaseSalary(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>นำเงินเดือนใหม่นี้ไปตั้งเป็นฐานเงินเดือนปัจจุบันของระบบทันที</span>
                </label>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                {editingRecord && sortedRecords.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenDeleteConfirm(editingRecord);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ลบรายการนี้</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingRecord ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* In-UI Delete Confirmation Modal */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">ยืนยันการลบรายการปรับเงินเดือน</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">รายการนี้จะถูกลบออกจากตารางการเติบโต</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 border border-slate-100 dark:border-slate-700/60">
              <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>ปีที่ {deletingRecord.tenureYear}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">฿{formatCurrency(deletingRecord.salaryAfter)}</span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>ช่วงมีผล:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatYearMonthThai(deletingRecord.effectiveMonth)} ({deletingRecord.effectiveMonth})</span>
              </div>
              {deletingRecord.note && (
                <div className="text-[11px] text-slate-400 truncate">
                  หมายเหตุ: {deletingRecord.note}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบรายการ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-UI Reset Template Confirmation Modal */}
      {isResetTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">รีเซ็ตตารางเงินเดือน</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">คืนค่าตารางกลับสู่ชุดเริ่มต้น 5 ช่วงปี (ปี 0 - 4)</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              ต้องการรีเซ็ตข้อมูลเป็นชุดเริ่มต้นตามตารางเดิม (เงินเดือน 33,000 - 37,429 บาท) ใช่หรือไม่?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetTemplateModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmResetTemplate}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              >
                ยืนยันรีเซ็ตค่าเริ่มต้น
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
