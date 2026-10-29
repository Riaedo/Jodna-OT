import React from 'react';
import { PayrollSettings, PayrollSummary } from '../types/overtime';
import { formatCurrency } from '../utils/calculator';
import { Wallet, DollarSign, Clock, Gift, ArrowUpRight, ShieldCheck, Receipt } from 'lucide-react';

interface MainMetricsCardsProps {
  summary: PayrollSummary;
  settings: PayrollSettings;
  cycleTaxPaid?: number;
  onOpenPaySlip?: () => void;
  onUpdateTaxPaid?: (tax: number) => void;
}

export const MainMetricsCards: React.FC<MainMetricsCardsProps> = ({
  summary,
  settings,
  cycleTaxPaid,
  onOpenPaySlip,
  onUpdateTaxPaid,
}) => {
  const currentTax = cycleTaxPaid !== undefined ? cycleTaxPaid : (settings.taxPaid || 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      
      {/* 1. เงินได้สุทธิ (Net Income) - มีการใส่ค่าภาษีที่จ่ายไป เข้ามาคำนวณด้วย */}
      <div 
        onClick={onOpenPaySlip}
        className="relative overflow-hidden rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-700/40 cursor-pointer hover:border-indigo-500/60 transition-all group flex flex-col justify-between"
      >
        <div className="absolute top-0 right-0 -mt-2 -mr-2 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/20 transition-all"></div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-indigo-300 flex items-center gap-1 sm:gap-1.5">
              <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">เงินได้สุทธิ</span>
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5 shrink-0">
              <ShieldCheck className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Net</span>
            </span>
          </div>

          <div className="mt-1 sm:mt-1.5">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold text-emerald-400">฿</span>
              <span className="truncate text-emerald-300 tabular-nums font-mono">{formatCurrency(summary.netIncome)}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 flex items-center justify-between">
              <span className="truncate">(ก่อนหัก - ภาษี)</span>
              <ArrowUpRight className="w-3 h-3 text-indigo-400 shrink-0 hidden sm:block" />
            </p>
          </div>
        </div>

        {/* 3: ช่องใส่ค่าภาษีที่จ่ายไป เข้ามาคำนวณด้วย */}
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="mt-2 pt-1.5 border-t border-indigo-800/60 flex flex-wrap xs:flex-nowrap items-center justify-between gap-1 text-[10px] sm:text-[11px]"
        >
          <span className="text-indigo-200 text-[10px] font-medium flex items-center gap-1 shrink-0">
            <Receipt className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">ภาษี:</span>
          </span>
          <div className="flex items-center gap-0.5 bg-black/40 px-1.5 py-0.5 rounded-lg border border-indigo-400/40 focus-within:border-emerald-400 focus-within:bg-black/60 transition-colors flex-1 xs:flex-none justify-end">
            <span className="text-[10px] text-indigo-300 font-bold">฿</span>
            <input
              type="number"
              min="0"
              step="any"
              value={currentTax > 0 ? currentTax : ''}
              placeholder="0.00"
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0);
                if (onUpdateTaxPaid) {
                  onUpdateTaxPaid(val);
                }
              }}
              className="w-14 sm:w-20 bg-transparent text-white font-bold text-[11px] text-right focus:outline-none placeholder-slate-500"
              title="ระบุภาษีที่จ่ายไป เพื่อนำมาหักคำนวณเงินได้สุทธิของรอบเดือนนี้"
            />
          </div>
        </div>
      </div>

      {/* 2. เงินได้ก่อนหักภาษี (Income Before Tax) - ขยับมาแทนที่ รวมเงินได้ก่อนหัก */}
      <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5">
              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">ก่อนหักภาษี</span>
            </span>
            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
              Before Tax
            </span>
          </div>
          <div className="mt-1 sm:mt-1.5">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold text-slate-400">฿</span>
              <span className="truncate tabular-nums font-mono">{formatCurrency(summary.incomeBeforeTax)}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              ก่อนหักภาษี ฿{formatCurrency(summary.taxPaid)}
            </p>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span className="truncate">ฐานเงินเดือนรอบนี้:</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono ml-1 shrink-0">฿{formatCurrency(settings.baseSalary)}</span>
        </div>
      </div>

      {/* 3. ค่า OT รวม (Total OT Pay) */}
      <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">ค่า OT รวม</span>
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
              {summary.totalOtHours}h
            </span>
          </div>
          <div className="mt-1 sm:mt-1.5">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold">฿</span>
              <span className="truncate tabular-nums font-mono">{formatCurrency(summary.totalOtAmount)}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              จาก <strong>{summary.totalOtHours} ชม.</strong>
            </p>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 truncate">
          <span>1.5x: ฿{formatCurrency(summary.ot1_5_amount)}</span>
        </div>
      </div>

      {/* 4. สวัสดิการรวม (Total Allowances & Benefits) */}
      <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5">
              <Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="truncate">สวัสดิการรวม</span>
            </span>
            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
              Allowances
            </span>
          </div>
          <div className="mt-1 sm:mt-1.5">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold text-purple-500">฿</span>
              <span className="truncate tabular-nums font-mono">{formatCurrency(summary.totalFixedAllowances)}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              บ้าน, กันดาร, ค่ากะ, เบี้ยขยัน
            </p>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 truncate">
          <span>ค่าบ้าน ฿{formatCurrency(settings.housingAllowance)}</span>
        </div>
      </div>

    </div>
  );
};
