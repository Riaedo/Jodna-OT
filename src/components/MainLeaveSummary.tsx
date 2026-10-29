import React from 'react';
import { PayrollSettings, PayrollSummary } from '../types/overtime';
import { formatCurrency, getVacationQuotaForYear } from '../utils/calculator';
import { CalendarDays, ChevronRight } from 'lucide-react';

interface MainLeaveSummaryProps {
  summary: PayrollSummary;
  settings: PayrollSettings;
  cycleYear?: number;
  onGoToLeaveView?: () => void;
}

export const MainLeaveSummary: React.FC<MainLeaveSummaryProps> = ({
  summary,
  settings,
  cycleYear = 2026,
  onGoToLeaveView,
}) => {
  const vacationQuota = getVacationQuotaForYear(cycleYear, settings.yearlyVacationQuotas, settings.leaveVacationQuota || 8).totalQuota;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      
      {/* 2: Header (ลดขนาดลง 30%) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-tight">
              สรุปวันลาและการมาทำงานรอบนี้
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              สถานะการลาและวันหยุดรอบวิกปัจจุบัน
            </p>
          </div>
        </div>

        {onGoToLeaveView && (
          <button
            onClick={onGoToLeaveView}
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors self-start sm:self-auto"
          >
            <span>ดูบันทึกสะสมทั้งปี</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Grid of Leave Stats (ลดขนาดลง 30%) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 mt-2.5">
        
        {/* ลาป่วย (E) */}
        <div className="p-2 sm:p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">ลาป่วย (E)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
              {summary.sickLeaveCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">วัน</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-0.5 truncate">
            โควต้า: {settings.leaveSickQuota} วัน
          </span>
        </div>

        {/* ลากิจ (D) */}
        <div className="p-2 sm:p-2.5 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">ลากิจ (D)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-400">
              {summary.personalLeaveCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">วัน</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-0.5 truncate">
            โควต้า: {settings.leavePersonalQuota} วัน
          </span>
        </div>

        {/* ลาพักร้อน (J) */}
        <div className="p-2 sm:p-2.5 rounded-lg bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">พักร้อน (J)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-teal-600 dark:text-teal-400">
              {summary.vacationLeaveCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">วัน</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-0.5 truncate">
            โควต้า: {vacationQuota} วัน
          </span>
        </div>

        {/* รวมวันลาทั้งหมด */}
        <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">รวมวันลา</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              summary.leaveDaysCount === 0 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
            }`}>
              {summary.leaveDaysCount === 0 ? 'ครบ' : 'มีลา'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
              {summary.leaveDaysCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">วัน</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
            เบี้ยขยัน: ฿{formatCurrency(summary.diligenceAmount)}
          </span>
        </div>

        {/* วันหยุดรอบนี้ (H) */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 p-2 sm:p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">วันหยุด (H)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
              {summary.holidayCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">วัน</span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-0.5 truncate">
            เสาร์-อาทิตย์ & นักขัตฤกษ์
          </span>
        </div>

      </div>

    </div>
  );
};
