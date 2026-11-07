import React from 'react';
import { PayrollSettings, PayrollSummary } from '../types/overtime';
import { getVacationQuotaForYear } from '../utils/calculator';
import { CalendarDays, ChevronRight } from 'lucide-react';

interface MainLeaveSummaryProps {
  summary: PayrollSummary;
  settings?: PayrollSettings;
  cycleYear?: number;
  onGoToLeaveView?: () => void;
  embedded?: boolean;
}

export const MainLeaveSummary: React.FC<MainLeaveSummaryProps> = ({
  summary,
  settings,
  cycleYear = 2026,
  onGoToLeaveView,
  embedded = false,
}) => {
  const vacationQuota = getVacationQuotaForYear(
    cycleYear,
    settings?.yearlyVacationQuotas,
    settings?.leaveVacationQuota || 8
  ).totalQuota;

  const containerClasses = embedded
    ? 'border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/30 p-3 sm:p-4 transition-colors'
    : 'bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors';

  return (
    <div className={containerClasses}>
      
      {/* Compact Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-none">
            สรุปวันลาและการมาทำงานรอบนี้
          </h4>
        </div>

        {onGoToLeaveView && (
          <button
            onClick={onGoToLeaveView}
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors px-2 py-0.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 active:scale-95"
            title="ดูบันทึกสะสมปีนี้"
          >
            <span>ดูบันทึกสะสมปีนี้</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 5-Item Compact Horizontal Summary Grid (Single Row on Desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
        
        {/* 1. ลาป่วย (E) */}
        <div className="flex items-center justify-between sm:justify-start sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
              ลาป่วย (E)
            </span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
              {summary.sickLeaveCount}
            </span>
            <span className="text-[10px] text-slate-400">
              /{settings?.leaveSickQuota ?? 30} วัน
            </span>
          </div>
        </div>

        {/* 2. ลากิจ (D) */}
        <div className="flex items-center justify-between sm:justify-start sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
              ลากิจ (D)
            </span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm sm:text-base font-black text-orange-600 dark:text-orange-400">
              {summary.personalLeaveCount}
            </span>
            <span className="text-[10px] text-slate-400">
              /{settings?.leavePersonalQuota ?? 6} วัน
            </span>
          </div>
        </div>

        {/* 3. พักร้อน (J) */}
        <div className="flex items-center justify-between sm:justify-start sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
              พักร้อน (J)
            </span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm sm:text-base font-black text-teal-600 dark:text-teal-400">
              {summary.vacationLeaveCount}
            </span>
            <span className="text-[10px] text-slate-400">
              /{vacationQuota} วัน
            </span>
          </div>
        </div>

        {/* 4. รวมวันลา */}
        <div className="flex items-center justify-between sm:justify-start sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${summary.leaveDaysCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
              รวมวันลา
            </span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
              {summary.leaveDaysCount}
            </span>
            <span className="text-[10px] text-slate-400">
              วัน
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ml-1 ${
              summary.leaveDaysCount === 0 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
            }`}>
              {summary.leaveDaysCount === 0 ? 'ครบ' : 'มีลา'}
            </span>
          </div>
        </div>

        {/* 5. วันหยุด (H) */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-center justify-between sm:justify-start sm:gap-3 p-2 sm:p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
              วันหยุด (H)
            </span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
              {summary.holidayCount}
            </span>
            <span className="text-[10px] text-slate-400">
              วัน
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
