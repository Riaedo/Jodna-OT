import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  HeartHandshake,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  CustomTaxStimulusItem,
  DailyRecord,
  PaySlipAttachment,
  PayrollSettings,
  SalaryIncrementRecord,
  TaxDeductionConfig,
} from '../types/overtime';
import { useMoneyVisibility } from '../context/MoneyVisibilityContext';
import { formatCurrency, getCycleForDate, getLatestCycleAndDate, round2 } from '../utils/calculator';
import {
  DEFAULT_TAX_DEDUCTION_CONFIG,
  aggregateYearPaySlipsForTaxSync,
  calculateAnnualTaxPlan,
  normalizeTaxDeductionConfig,
} from '../utils/taxCalculator';

interface TaxCalculatorViewProps {
  allCycleRecords: Record<string, DailyRecord[]>;
  cycleTaxes: Record<string, number>;
  paySlips?: PaySlipAttachment[];
  settings: PayrollSettings;
  salaryIncrements?: SalaryIncrementRecord[];
  onUpdateCycleTax?: (cycleKey: string, tax: number, silent?: boolean) => Promise<void> | void;
  onBatchUpdateCycleTaxes?: (updates: Record<string, number>, options?: { silent?: boolean }) => Promise<void> | void;
  onUpdateYearlyTaxDeductions?: (
    year: number,
    config: TaxDeductionConfig,
    silent?: boolean
  ) => Promise<void> | void;
  onNotify?: (message: string) => void;
}

function parseNonNegNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

function formatInputVal(n: number): string {
  return n > 0 ? String(Number(n.toFixed(2))) : '';
}

const STIMULUS_PRESETS: Array<{ label: string; name: string; maxLimit?: number }> = [
  { label: '+ Easy E-Receipt (50,000)', name: 'Easy E-Receipt / ช้อปดีมีคืน', maxLimit: 50000 },
  { label: '+ ท่องเที่ยวไทย (15,000)', name: 'เที่ยวเมืองรอง / ท่องเที่ยวไทย', maxLimit: 15000 },
  { label: '+ ซื้อสินค้า OTOP/หนังสือ', name: 'ซื้อสินค้า OTOP / หนังสือ', maxLimit: 15000 },
  { label: '+ ค่าสร้างบ้านใหม่ (100,000)', name: 'ค่าปลูกสร้าง / ซ่อมแซมบ้านใหม่', maxLimit: 100000 },
];

function createStimulusId(): string {
  return `stim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const TaxCalculatorView: React.FC<TaxCalculatorViewProps> = ({
  allCycleRecords,
  cycleTaxes,
  paySlips = [],
  settings,
  salaryIncrements = [],
  onUpdateCycleTax,
  onBatchUpdateCycleTaxes,
  onUpdateYearlyTaxDeductions,
  onNotify,
}) => {
  const { isMoneyHidden, formatMoney } = useMoneyVisibility();

  // Determine selectable tax years
  const availableYears = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const latest = getLatestCycleAndDate(
      settings.cycleStartDay,
      settings.cycleEndDay,
      Object.keys(allCycleRecords)
    );
    const startYear =
      settings.workStartDate && settings.workStartDate.trim() !== ''
        ? getCycleForDate(settings.workStartDate, settings.cycleStartDay, settings.cycleEndDay).year
        : nowYear;

    const yearSet = new Set<number>([nowYear, latest.year, startYear]);
    for (let y = Math.min(nowYear, startYear); y <= Math.max(nowYear + 1, latest.year, 2028); y++) {
      yearSet.add(y);
    }
    Object.keys(allCycleRecords).forEach((k) => {
      const y = Number(k.split('-')[0]);
      if (y >= 2020 && y <= 2100) yearSet.add(y);
    });
    Object.keys(cycleTaxes).forEach((k) => {
      const y = Number(k.split('-')[0]);
      if (y >= 2020 && y <= 2100) yearSet.add(y);
    });
    paySlips.forEach((s) => {
      const y = Number((s.cycleKey || '').split('-')[0]);
      if (y >= 2020 && y <= 2100) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [allCycleRecords, cycleTaxes, paySlips, settings.workStartDate, settings.cycleStartDay, settings.cycleEndDay]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const nowY = new Date().getFullYear();
    return availableYears.includes(nowY) ? nowY : availableYears[0] || 2026;
  });

  // Draft deduction config for the currently selected tax year
  const savedYearConfig = useMemo(
    () => normalizeTaxDeductionConfig(settings.yearlyTaxDeductions?.[selectedYear]),
    [settings.yearlyTaxDeductions, selectedYear]
  );

  const [draftConfig, setDraftConfig] = useState<TaxDeductionConfig>(savedYearConfig);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Sync draft when user switches year or remote cloud settings arrive while clean
  const lastLoadedYearRef = useRef<number>(selectedYear);
  useEffect(() => {
    if (lastLoadedYearRef.current !== selectedYear || !hasUnsavedChanges) {
      lastLoadedYearRef.current = selectedYear;
      setDraftConfig(savedYearConfig);
      setHasUnsavedChanges(false);
    }
  }, [selectedYear, savedYearConfig, hasUnsavedChanges]);

  // Silent auto-save debounce so edits persist seamlessly across refreshes
  useEffect(() => {
    if (!hasUnsavedChanges || !onUpdateYearlyTaxDeductions) return;
    const timer = setTimeout(() => {
      void Promise.resolve(onUpdateYearlyTaxDeductions(selectedYear, draftConfig, true)).then(() => {
        setHasUnsavedChanges(false);
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, draftConfig, selectedYear, onUpdateYearlyTaxDeductions]);

  const updateDraft = (patch: Partial<TaxDeductionConfig>) => {
    setDraftConfig((prev) => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  const handleAddStimulusItem = (preset?: { name: string; maxLimit?: number }) => {
    const newItem: CustomTaxStimulusItem = {
      id: createStimulusId(),
      name: preset?.name || '',
      amount: 0,
      ...(preset?.maxLimit ? { maxLimit: preset.maxLimit } : {}),
      enabled: true,
    };
    updateDraft({
      easyEReceipt: 0,
      customStimulusItems: [...(draftConfig.customStimulusItems || []), newItem],
    });
  };

  const handleUpdateStimulusItem = (
    itemId: string,
    patch: Partial<CustomTaxStimulusItem>
  ) => {
    const nextList = (draftConfig.customStimulusItems || []).map((item) => {
      if (item.id !== itemId) return item;
      const merged: CustomTaxStimulusItem = {
        ...item,
        ...patch,
      };
      if (merged.maxLimit === undefined || merged.maxLimit === null || Number(merged.maxLimit) <= 0) {
        delete merged.maxLimit;
      }
      return merged;
    });
    updateDraft({
      easyEReceipt: 0,
      customStimulusItems: nextList,
    });
  };

  const handleRemoveStimulusItem = (itemId: string) => {
    const nextList = (draftConfig.customStimulusItems || []).filter((item) => item.id !== itemId);
    updateDraft({
      easyEReceipt: 0,
      customStimulusItems: nextList,
    });
  };

  const handleSaveManual = async () => {
    if (!onUpdateYearlyTaxDeductions || isSavingPlan) return;
    setIsSavingPlan(true);
    try {
      await onUpdateYearlyTaxDeductions(selectedYear, draftConfig, false);
      setHasUnsavedChanges(false);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleResetYearConfig = async () => {
    const resetCfg = { ...DEFAULT_TAX_DEDUCTION_CONFIG };
    setDraftConfig(resetCfg);
    setHasUnsavedChanges(false);
    if (onUpdateYearlyTaxDeductions) {
      await onUpdateYearlyTaxDeductions(selectedYear, resetCfg, true);
    }
    if (onNotify) {
      onNotify(`รีเซ็ตค่าลดหย่อนภาษีปี ${selectedYear} เป็นค่าเริ่มต้นแล้ว`);
    }
  };

  // Inline withholding tax editor & PaySlip Vault sync state
  const [editingTaxCycleKey, setEditingTaxCycleKey] = useState<string | null>(null);
  const [editingTaxValue, setEditingTaxValue] = useState<string>('');
  const [isSyncingFromSlips, setIsSyncingFromSlips] = useState(false);

  useEffect(() => {
    if (isMoneyHidden) {
      setEditingTaxCycleKey(null);
    }
  }, [isMoneyHidden]);

  const handleCommitCycleTax = (cycleKey: string) => {
    const val = Math.max(0, round2(Number(editingTaxValue) || 0));
    if (onUpdateCycleTax) {
      onUpdateCycleTax(cycleKey, val);
    }
    setEditingTaxCycleKey(null);
  };

  // Live tax calculation using draftConfig
  const taxPlan = useMemo(
    () =>
      calculateAnnualTaxPlan({
        year: selectedYear,
        allCycleRecords,
        cycleTaxes,
        settings,
        salaryIncrements,
        configOverride: draftConfig,
      }),
    [selectedYear, allCycleRecords, cycleTaxes, settings, salaryIncrements, draftConfig]
  );

  // Aggregate PaySlip Vault data for selectedYear
  const yearSlipSync = useMemo(
    () => aggregateYearPaySlipsForTaxSync(paySlips, selectedYear),
    [paySlips, selectedYear]
  );

  const taxOutOfSyncCount = useMemo(() => {
    return Object.entries(yearSlipSync.cycleTaxUpdates).filter(([ck, slipTax]) => {
      const currentVal = round2(Math.max(0, Number(cycleTaxes[ck]) || 0));
      return Math.abs(round2(slipTax - currentVal)) >= 0.01;
    }).length;
  }, [yearSlipSync.cycleTaxUpdates, cycleTaxes]);

  const ssoDiffersFromSlips =
    yearSlipSync.slipsWithSsoCount > 0 &&
    Math.abs(round2(taxPlan.effectiveSocialSecurity - yearSlipSync.cappedSocialSecurityFromSlips)) >= 0.01;

  const hasAnySlipSyncData =
    yearSlipSync.slipsWithTaxCount > 0 || yearSlipSync.slipsWithSsoCount > 0;

  const isAllSyncedWithSlips =
    hasAnySlipSyncData && taxOutOfSyncCount === 0 && !ssoDiffersFromSlips;

  const handleSyncFromPaySlipVault = async () => {
    if (isSyncingFromSlips) return;
    if (!hasAnySlipSyncData) {
      if (onNotify) {
        onNotify(
          yearSlipSync.rawSlipCount === 0
            ? `ไม่พบสลิปเงินเดือนในปี ${selectedYear} ในคลังสลิป`
            : `พบสลิปปี ${selectedYear} (${yearSlipSync.rawSlipCount} ใบ) แต่ยังไม่มีข้อมูลยอดภาษีหรือประกันสังคมที่บันทึกไว้`
        );
      }
      return;
    }

    setIsSyncingFromSlips(true);
    try {
      const taxEntries = Object.entries(yearSlipSync.cycleTaxUpdates);
      if (taxEntries.length > 0) {
        if (onBatchUpdateCycleTaxes) {
          await onBatchUpdateCycleTaxes(yearSlipSync.cycleTaxUpdates, { silent: true });
        } else if (onUpdateCycleTax) {
          for (const [ck, taxVal] of taxEntries) {
            await onUpdateCycleTax(ck, taxVal, true);
          }
        }
      }

      if (yearSlipSync.slipsWithSsoCount > 0) {
        const nextCfg: TaxDeductionConfig = {
          ...draftConfig,
          socialSecurityOverride: yearSlipSync.cappedSocialSecurityFromSlips,
        };
        setDraftConfig(nextCfg);
        setHasUnsavedChanges(false);
        if (onUpdateYearlyTaxDeductions) {
          await onUpdateYearlyTaxDeductions(selectedYear, nextCfg, true);
        }
      }

      if (onNotify) {
        const parts: string[] = [];
        if (yearSlipSync.slipsWithTaxCount > 0) {
          parts.push(
            `ภาษีหัก ณ ที่จ่าย ${yearSlipSync.slipsWithTaxCount} เดือน (${formatMoney(yearSlipSync.totalTaxFromSlips)})`
          );
        }
        if (yearSlipSync.slipsWithSsoCount > 0) {
          parts.push(
            `ประกันสังคมสะสม ${formatMoney(yearSlipSync.cappedSocialSecurityFromSlips)}`
          );
        }
        onNotify(`ซิงค์ข้อมูลจากคลังสลิปปี ${selectedYear} สำเร็จ: ${parts.join(' · ')}`);
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify(err?.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลจากคลังสลิป');
      }
    } finally {
      setIsSyncingFromSlips(false);
    }
  };

  const isSsoOverridden =
    draftConfig.socialSecurityOverride !== null &&
    draftConfig.socialSecurityOverride !== undefined;
  const isPvdOverridden =
    draftConfig.providentFundOverride !== null &&
    draftConfig.providentFundOverride !== undefined;

  const totalAutoSsoSum = taxPlan.monthlyRows.reduce((s, r) => s + r.socialSecurity, 0);
  const totalAutoPvdSum = taxPlan.monthlyRows.reduce((s, r) => s + r.providentFund, 0);
  const totalBaseSalarySum = taxPlan.monthlyRows.reduce((s, r) => s + r.baseSalary, 0);
  const totalOtSum = taxPlan.monthlyRows.reduce((s, r) => s + r.otAmount, 0);
  const totalAllowancesSum = taxPlan.monthlyRows.reduce((s, r) => s + r.allowancesAmount, 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Header & Tax Year Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Tax &amp; Deductions Planner</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">ปีภาษี ค.ศ. {selectedYear}</span>
            {hasUnsavedChanges && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">กำลังบันทึก...</span>
              </>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
            ระบบคำนวณและวางแผนภาษีประจำปี
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            ดึงข้อมูลรายได้ 12 รอบบิล ประกันสังคม กองทุนสำรองเลี้ยงชีพ และภาษีหัก ณ ที่จ่ายอัตโนมัติ พร้อมคำนวณขั้นบันไดและยอดขอคืนหรือจ่ายเพิ่มปลายปี
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <label
              htmlFor="tax-year-select"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
            >
              ปีภาษี:
            </label>
            <select
              id="tax-year-select"
              value={selectedYear}
              onChange={(e) => {
                setEditingTaxCycleKey(null);
                setSelectedYear(Number(e.target.value));
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  ค.ศ. {y} (พ.ศ. {y + 543})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={isSyncingFromSlips}
            onClick={handleSyncFromPaySlipVault}
            title="ดึงยอดภาษีหัก ณ ที่จ่าย (INCOME_TAX) และประกันสังคม (INSU_DEDU) จากคลังสลิปเงินเดือนของปีนี้มาอัปเดตอัตโนมัติ"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
              isAllSyncedWithSlips
                ? 'border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                : 'border border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200'
            }`}
          >
            {isSyncingFromSlips ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isAllSyncedWithSlips ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>
              {isSyncingFromSlips
                ? 'กำลังซิงค์จากคลังสลิป...'
                : 'ดึงยอดภาษีและประกันสังคมจากคลังสลิปทั้งปี'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleResetYearConfig}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>รีเซ็ตค่าลดหย่อน</span>
          </button>

          <button
            type="button"
            disabled={isSavingPlan}
            onClick={handleSaveManual}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingPlan ? 'กำลังบันทึก...' : 'บันทึกแผนลดหย่อน'}</span>
          </button>
        </div>
      </div>

      {/* 2. Highlight Year-End Tax Settlement Card */}
      <div
        className={`rounded-2xl p-5 sm:p-6 border transition-colors ${
          taxPlan.settlementStatus === 'REFUND'
            ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-800'
            : taxPlan.settlementStatus === 'PAYABLE'
            ? 'bg-rose-50/80 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800'
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold">
              {taxPlan.settlementStatus === 'REFUND' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <TrendingUp className="w-4 h-4" />
                  <span>สรุปผลประเมินภาษีปลายปี {selectedYear} · จ่ายเกินไว้</span>
                </span>
              ) : taxPlan.settlementStatus === 'PAYABLE' ? (
                <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <TrendingDown className="w-4 h-4" />
                  <span>สรุปผลประเมินภาษีปลายปี {selectedYear} · ต้องเตรียมชำระเพิ่ม</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>สรุปผลประเมินภาษีปลายปี {selectedYear} · สมดุลพอดี</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {taxPlan.settlementStatus === 'REFUND' ? (
                <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  มีสิทธิขอคืนภาษี (Tax Refund):{' '}
                  <span className="font-mono tabular-nums">
                    +{formatMoney(taxPlan.settlementAmountAbs)}
                  </span>
                </h3>
              ) : taxPlan.settlementStatus === 'PAYABLE' ? (
                <h3 className="text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-300">
                  ภาษีที่ต้องจ่ายเพิ่มปลายปี (Additional Tax Payable):{' '}
                  <span className="font-mono tabular-nums">
                    {formatMoney(taxPlan.settlementAmountAbs)}
                  </span>
                </h3>
              ) : (
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  ไม่ต้องเสียภาษีเพิ่ม
                </h3>
              )}
            </div>
          </div>

          {/* Side-by-side comparison: Computed vs Withheld */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5 shrink-0">
            <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl px-4 py-3 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">ภาษีที่คำนวณได้ทั้งปี</div>
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {formatMoney(taxPlan.totalComputedTax)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                ฐานสูงสุด {taxPlan.marginalRatePercent}% · เฉลี่ย {taxPlan.effectiveTaxRatePercent.toFixed(2)}%
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl px-4 py-3 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">หัก ณ ที่จ่ายไปแล้ว (12 เดือน)</div>
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400 mt-0.5">
                {formatMoney(taxPlan.totalWithholdingTaxPaid)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                แก้ไขยอดรายเดือนได้ในตารางด้านล่าง
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 4-Column Tax Calculation Pipeline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            1. เงินได้พึงประเมินทั้งปี
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatMoney(taxPlan.totalAnnualGrossIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums truncate">
            12 รอบบิล {formatMoney(taxPlan.cycleGrossIncomeTotal)} + พิเศษ {formatMoney(taxPlan.otherIncomeBonus)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            2. หักค่าใช้จ่าย (50% สูงสุด 1 แสน)
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {formatMoney(taxPlan.expenseDeduction, { prefix: '-฿' })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            หักเหมาตามมาตรา 40(1)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            3. รวมค่าลดหย่อนทั้งหมด
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(taxPlan.totalDeductions, { prefix: '-฿' })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums truncate">
            ครอบครัว + ประกัน/กองทุน + อื่นๆ
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            4. เงินได้สุทธิเพื่อเสียภาษี
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-1">
            {formatMoney(taxPlan.netTaxableIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            ฐานภาษีสูงสุด: {taxPlan.marginalRatePercent}%
          </div>
        </div>
      </div>

      {/* 4. Main Workspace: Left = Deductions Form | Right = Progressive Tax Brackets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Tax Deductions & Extra Income Form */}
        <div className="lg:col-span-7 space-y-5">
          {/* Extra Income / Bonus */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  รายได้พิเศษเพิ่มเติมทั้งปี (โบนัส / รายได้อื่น)
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                +{formatMoney(taxPlan.otherIncomeBonus)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label
                  htmlFor="tax-bonus-input"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1"
                >
                  โบนัสประจำปี / เงินได้อื่นนอกรอบบิล (บาท)
                </label>
                <input
                  id="tax-bonus-input"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.otherIncomeBonus)}
                  onChange={(e) =>
                    updateDraft({ otherIncomeBonus: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                ระบบรวมฐานเงินเดือน ค่าโอที ค่ากะ เบี้ยขยัน และสวัสดิการจาก 12 รอบบิลให้อัตโนมัติแล้ว หากมีโบนัสหรือรายได้พิเศษเพิ่มเติมให้กรอกในช่องนี้
              </p>
            </div>
          </div>

          {/* Group 1: Personal & Family */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  กลุ่ม 1: ค่าลดหย่อนส่วนตัวและครอบครัว
                </h3>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(taxPlan.familyDeductionsTotal)}
              </span>
            </div>

            <div className="space-y-3.5 text-sm">
              {/* Personal 60,000 */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    ค่าลดหย่อนส่วนตัว
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    สิทธิ์พื้นฐานผู้มีเงินได้ทุกคน (อัตโนมัติ)
                  </span>
                </div>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatMoney(60000)}
                </span>
              </div>

              {/* Spouse Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    คู่สมรส (จดทะเบียนสมรสและไม่มีรายได้)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    ลดหย่อนได้ 60,000 บาท
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                    {formatMoney(taxPlan.spouseDeduction)}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftConfig.hasSpouse}
                    onClick={() => updateDraft({ hasSpouse: !draftConfig.hasSpouse })}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      draftConfig.hasSpouse ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        draftConfig.hasSpouse ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label
                    htmlFor="tax-child-before2018"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                  >
                    บุตรคนแรก / เกิดก่อนปี 2561 (คนละ 30,000)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="tax-child-before2018"
                      type="number"
                      min="0"
                      max="20"
                      step="1"
                      placeholder="0"
                      value={draftConfig.childCountBefore2018 > 0 ? draftConfig.childCountBefore2018 : ''}
                      onChange={(e) =>
                        updateDraft({
                          childCountBefore2018: Math.min(20, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                        })
                      }
                      className="w-24 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      = {formatMoney(draftConfig.childCountBefore2018 * 30000)}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="tax-child-from2018"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                  >
                    บุตรคนที่ 2+ เกิดตั้งแต่ปี 2561 (คนละ 60,000)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="tax-child-from2018"
                      type="number"
                      min="0"
                      max="20"
                      step="1"
                      placeholder="0"
                      value={draftConfig.childCountFrom2018 > 0 ? draftConfig.childCountFrom2018 : ''}
                      onChange={(e) =>
                        updateDraft({
                          childCountFrom2018: Math.min(20, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                        })
                      }
                      className="w-24 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      = {formatMoney(draftConfig.childCountFrom2018 * 60000)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parents Care (0-4) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    อุปการะเลี้ยงดูบิดามารดา (อายุ 60 ปีขึ้นไป)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    0–4 คน (คนละ 30,000 บาท สูงสุด 120,000 บาท)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {[0, 1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => updateDraft({ parentsCareCount: count })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono tabular-nums transition-colors cursor-pointer ${
                          draftConfig.parentsCareCount === count
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 min-w-[76px] text-right">
                    {formatMoney(taxPlan.parentsDeduction)}
                  </span>
                </div>
              </div>

              {/* Disabled / Dependent Care (60,000 per person) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    อุปการะผู้พิการหรือผู้ทุพพลภาพ
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    คนละ 60,000 บาท (ตามเกณฑ์กรมสรรพากร ปรับจำนวนคนได้)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      aria-label="ลดจำนวนผู้พิการในอุปการะ"
                      onClick={() =>
                        updateDraft({
                          disabledCareCount: Math.max(0, (draftConfig.disabledCareCount || 0) - 1),
                        })
                      }
                      className="w-7 h-7 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      id="tax-disabled-care"
                      type="number"
                      min="0"
                      max="20"
                      step="1"
                      aria-label="จำนวนผู้พิการที่อุปการะ"
                      value={draftConfig.disabledCareCount > 0 ? draftConfig.disabledCareCount : 0}
                      onChange={(e) =>
                        updateDraft({
                          disabledCareCount: Math.min(
                            20,
                            Math.max(0, Math.floor(Number(e.target.value) || 0))
                          ),
                        })
                      }
                      className="w-12 text-center bg-transparent text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="เพิ่มจำนวนผู้พิการในอุปการะ"
                      onClick={() =>
                        updateDraft({
                          disabledCareCount: Math.min(20, (draftConfig.disabledCareCount || 0) + 1),
                        })
                      }
                      className="w-7 h-7 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 min-w-[76px] text-right">
                    {formatMoney(taxPlan.disabledCareDeduction)}
                  </span>
                </div>
              </div>

              {/* Prenatal & Childbirth Expense (max 60,000) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label
                    htmlFor="tax-prenatal-expense"
                    className="font-medium text-slate-800 dark:text-slate-100 block"
                  >
                    ค่าฝากครรภ์และคลอดบุตร (สูงสุด 60,000)
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    ลดหย่อนตามที่จ่ายจริง ไม่เกิน 60,000 บาท
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <input
                    id="tax-prenatal-expense"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={formatInputVal(draftConfig.prenatalAndChildbirthExpense)}
                    onChange={(e) =>
                      updateDraft({
                        prenatalAndChildbirthExpense: parseNonNegNumber(e.target.value),
                      })
                    }
                    className="w-full sm:w-40 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
                  />
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 min-w-[76px] text-right">
                    {formatMoney(taxPlan.effectivePrenatalExpense)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Insurance & Funds */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  กลุ่ม 2: ประกันและกองทุนลดหย่อน
                </h3>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(taxPlan.insuranceAndFundsTotal)}
              </span>
            </div>

            {/* Auto-pulled SSO & PVD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="tax-sso-input"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    ประกันสังคมสะสมทั้งปี (สูงสุด {taxPlan.ssoAnnualCap.toLocaleString('en-US')})
                  </label>
                  {isSsoOverridden ? (
                    <button
                      type="button"
                      onClick={() => updateDraft({ socialSecurityOverride: null })}
                      className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      ใช้ค่าจากแอป ({formatMoney(taxPlan.autoSocialSecurity)})
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ดึงจาก 12 รอบบิล
                    </span>
                  )}
                </div>
                <input
                  id="tax-sso-input"
                  type="number"
                  min="0"
                  max={taxPlan.ssoAnnualCap}
                  step="any"
                  value={
                    isSsoOverridden
                      ? formatInputVal(draftConfig.socialSecurityOverride || 0)
                      : formatInputVal(taxPlan.autoSocialSecurity)
                  }
                  placeholder="0"
                  onChange={(e) =>
                    updateDraft({
                      socialSecurityOverride:
                        e.target.value.trim() === '' ? 0 : parseNonNegNumber(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {totalAutoSsoSum > taxPlan.ssoAnnualCap && !isSsoOverridden && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    ยอดหักจริง {formatMoney(totalAutoSsoSum)} (จำกัดสิทธิ์ลดหย่อน{' '}
                    {taxPlan.ssoAnnualCap.toLocaleString('en-US')} บาท)
                  </p>
                )}
                {yearSlipSync.slipsWithSsoCount > 0 && (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      ยอดปกส.จากสลิป ({yearSlipSync.slipsWithSsoCount} เดือน):{' '}
                      {formatMoney(yearSlipSync.totalSocialSecurityFromSlips)}
                    </span>
                    {ssoDiffersFromSlips ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft({
                            socialSecurityOverride: yearSlipSync.cappedSocialSecurityFromSlips,
                          })
                        }
                        className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        ใช้ยอดสลิป ({formatMoney(yearSlipSync.cappedSocialSecurityFromSlips)})
                      </button>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ตรงกับสลิปแล้ว</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="tax-pvd-input"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    กองทุนสำรองเลี้ยงชีพ PVD ทั้งปี
                  </label>
                  {isPvdOverridden ? (
                    <button
                      type="button"
                      onClick={() => updateDraft({ providentFundOverride: null })}
                      className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      ใช้ค่าจากแอป ({formatMoney(taxPlan.autoProvidentFund)})
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ดึงจาก 12 รอบบิล
                    </span>
                  )}
                </div>
                <input
                  id="tax-pvd-input"
                  type="number"
                  min="0"
                  step="any"
                  value={
                    isPvdOverridden
                      ? formatInputVal(draftConfig.providentFundOverride || 0)
                      : formatInputVal(taxPlan.autoProvidentFund)
                  }
                  placeholder="0"
                  onChange={(e) =>
                    updateDraft({
                      providentFundOverride:
                        e.target.value.trim() === '' ? 0 : parseNonNegNumber(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                  ยอดสะสมในแอป: {formatMoney(totalAutoPvdSum)}
                </p>
              </div>
            </div>

            {/* Life & Health Insurance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label
                  htmlFor="tax-life-ins"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  ประกันชีวิตทั่วไป (สูงสุด 100,000)
                </label>
                <input
                  id="tax-life-ins"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.lifeInsurance)}
                  onChange={(e) =>
                    updateDraft({ lifeInsurance: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label
                  htmlFor="tax-health-self"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  ประกันสุขภาพตนเอง (สูงสุด 25,000)
                </label>
                <input
                  id="tax-health-self"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.healthInsuranceSelf)}
                  onChange={(e) =>
                    updateDraft({ healthInsuranceSelf: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label
                  htmlFor="tax-health-parents"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  ประกันสุขภาพบิดามารดา (สูงสุด 15,000)
                </label>
                <input
                  id="tax-health-parents"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.healthInsuranceParents)}
                  onChange={(e) =>
                    updateDraft({ healthInsuranceParents: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {taxPlan.lifeHealthCombinedCapped && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  เบี้ยประกันชีวิตและประกันสุขภาพตนเองรวมกันใช้สิทธิได้สูงสุดไม่เกิน 100,000 บาท
                </span>
              </div>
            )}

            {/* Pension Insurance, RMF, SSF, Thai ESG */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label
                  htmlFor="tax-pension-ins"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  เบี้ยประกันชีวิตแบบบำนาญ (สูงสุด 15% ไม่เกิน 200,000)
                </label>
                <input
                  id="tax-pension-ins"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.pensionInsurance)}
                  onChange={(e) =>
                    updateDraft({ pensionInsurance: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums block mt-1">
                  ใช้สิทธิ (รวมในตะกร้าเกษียณ 5 แสน): {formatMoney(taxPlan.effectivePensionInsurance)}
                </span>
              </div>

              <div>
                <label
                  htmlFor="tax-rmf"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  กองทุน RMF (ไม่เกิน 30% ของเงินได้)
                </label>
                <input
                  id="tax-rmf"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.rmfAmount)}
                  onChange={(e) => updateDraft({ rmfAmount: parseNonNegNumber(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums block mt-1">
                  ใช้สิทธิ: {formatMoney(taxPlan.effectiveRmf)}
                </span>
              </div>

              <div>
                <label
                  htmlFor="tax-ssf"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  กองทุน SSF (ไม่เกิน 200,000)
                </label>
                <input
                  id="tax-ssf"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.ssfAmount)}
                  onChange={(e) => updateDraft({ ssfAmount: parseNonNegNumber(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums block mt-1">
                  ใช้สิทธิ: {formatMoney(taxPlan.effectiveSsf)}
                </span>
              </div>

              <div>
                <label
                  htmlFor="tax-thai-esg"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  กองทุน Thai ESG (ไม่เกิน 300,000)
                </label>
                <input
                  id="tax-thai-esg"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.thaiEsgAmount)}
                  onChange={(e) =>
                    updateDraft({ thaiEsgAmount: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums block mt-1">
                  ใช้สิทธิ: {formatMoney(taxPlan.effectiveThaiEsg)}
                </span>
              </div>
            </div>

            {taxPlan.retirementBasketCapped && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  กลุ่มเกษียณ (PVD + ประกันบำนาญ + RMF + SSF) รวมกันสูงสุดตามกฎหมายไม่เกิน 500,000 บาท (Thai ESG แยกวงเงินต่างหาก)
                </span>
              </div>
            )}
          </div>

          {/* Group 3: Stimulus & Donations */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  กลุ่ม 3: กระตุ้นเศรษฐกิจและเงินบริจาค
                </h3>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(taxPlan.stimulusAndDonationsTotal)}
              </span>
            </div>

            {/* Standard Home Loan Interest */}
            <div>
              <label
                htmlFor="tax-home-interest"
                className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
              >
                ดอกเบี้ยกู้ซื้อที่อยู่อาศัย (สูงสุด 100,000 บาท)
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <input
                  id="tax-home-interest"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.homeLoanInterest)}
                  onChange={(e) =>
                    updateDraft({ homeLoanInterest: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full sm:w-64 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  ใช้สิทธิ: {formatMoney(taxPlan.effectiveHomeInterest)}
                </span>
              </div>
            </div>

            {/* Dynamic Custom Economic Stimulus List per Tax Year */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    โครงการกระตุ้นเศรษฐกิจและอื่นๆ (ปรับเพิ่ม/ลบอิสระเฉพาะปี {selectedYear})
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    เพิ่มชื่อโครงการและเพดานได้เอง หรือลบโครงการที่ไม่มีในปีนี้ออกโดยไม่กระทบปีอื่น · รวมใช้สิทธิ{' '}
                    <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(taxPlan.effectiveCustomStimulusTotal)}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddStimulusItem()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มโครงการลดหย่อน</span>
                </button>
              </div>

              {/* Quick Preset Chips (Interactive Action Buttons) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">
                  ตัวเลือกด่วน:
                </span>
                {STIMULUS_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleAddStimulusItem(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Rows */}
              {(draftConfig.customStimulusItems || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  ยังไม่มีโครงการกระตุ้นเศรษฐกิจในปีภาษี {selectedYear} — กดปุ่มตัวเลือกด่วนด้านบน หรือคลิก &ldquo;+ เพิ่มโครงการลดหย่อน&rdquo; เพื่อเพิ่มรายการ
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {(draftConfig.customStimulusItems || []).map((item, idx) => {
                    const breakdown = taxPlan.customStimulusBreakdown.find((b) => b.id === item.id);
                    const effectiveAmount = breakdown?.effectiveAmount ?? 0;
                    const isCapped = Boolean(breakdown?.isCapped);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 sm:p-3.5 transition-colors ${
                          item.enabled === false
                            ? 'bg-slate-50/70 dark:bg-slate-900/60 opacity-65'
                            : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                          {/* Enable toggle + Project name */}
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.enabled !== false}
                              onChange={(e) =>
                                handleUpdateStimulusItem(item.id, { enabled: e.target.checked })
                              }
                              aria-label={`เปิดใช้งานโครงการ ${item.name || idx + 1}`}
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                handleUpdateStimulusItem(item.id, { name: e.target.value })
                              }
                              placeholder="ชื่อโครงการ เช่น Easy E-Receipt, เที่ยวเมืองรอง"
                              aria-label={`ชื่อโครงการลดหย่อน ${idx + 1}`}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>

                          {/* Amount + Optional Max Limit + Delete */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-28 sm:w-32">
                              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                                ยอดใช้สิทธิ์ (บาท)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={formatInputVal(item.amount)}
                                onChange={(e) =>
                                  handleUpdateStimulusItem(item.id, {
                                    amount: parseNonNegNumber(e.target.value),
                                  })
                                }
                                aria-label={`ยอดเงินโครงการ ${item.name || idx + 1}`}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
                              />
                            </div>

                            <div className="w-24 sm:w-28">
                              <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                                เพดาน (ถ้ามี)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="ไม่จำกัด"
                                value={item.maxLimit && item.maxLimit > 0 ? String(item.maxLimit) : ''}
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  const val = raw === '' ? undefined : parseNonNegNumber(raw);
                                  handleUpdateStimulusItem(item.id, {
                                    maxLimit: val && val > 0 ? val : undefined,
                                  });
                                }}
                                aria-label={`เพดานสูงสุดโครงการ ${item.name || idx + 1}`}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveStimulusItem(item.id)}
                              title="ลบโครงการนี้ออกจากปีภาษีนี้"
                              aria-label={`ลบโครงการ ${item.name || idx + 1}`}
                              className="mt-4 p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-1.5 pl-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          <span>
                            ใช้สิทธิจริง: <strong className="text-slate-700 dark:text-slate-200">{formatMoney(effectiveAmount)}</strong>
                            {item.enabled === false && ' (ปิดใช้งานชั่วคราว)'}
                          </span>
                          {isCapped && item.maxLimit && (
                            <span className="text-amber-600 dark:text-amber-400 font-sans">
                              จำกัดตามเพดานสูงสุด {formatMoney(item.maxLimit)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Standard Donations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label
                  htmlFor="tax-donation-2x"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  บริจาคการศึกษา / กีฬา / รพ.รัฐ (ลดหย่อน 2 เท่า)
                </label>
                <input
                  id="tax-donation-2x"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.donation2xEducation)}
                  onChange={(e) =>
                    updateDraft({ donation2xEducation: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums block mt-1">
                  ลดหย่อนจริง (x2): {formatMoney(taxPlan.effectiveDonation2x)}
                </span>
              </div>

              <div>
                <label
                  htmlFor="tax-donation-general"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1"
                >
                  เงินบริจาคทั่วไป (ตามจริง 1 เท่า)
                </label>
                <input
                  id="tax-donation-general"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formatInputVal(draftConfig.donationGeneral)}
                  onChange={(e) =>
                    updateDraft({ donationGeneral: parseNonNegNumber(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums block mt-1">
                  ลดหย่อนจริง: {formatMoney(taxPlan.effectiveDonationGeneral)}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              เพดานลดหย่อนเงินบริจาครวมสูงสุดปีนี้ (10% หลังหักค่าใช้จ่ายและลดหย่อนอื่น):{' '}
              <strong className="text-slate-700 dark:text-slate-200">{formatMoney(taxPlan.donationCap)}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT: Progressive Tax Brackets Breakdown */}
        <div className="lg:col-span-5 space-y-5">
          {/* Progressive Tax Brackets Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  ตารางคำนวณภาษีแบบขั้นบันได
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-sky-700 dark:text-sky-400">
                ฐานสูงสุด {taxPlan.marginalRatePercent}%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-4">ช่วงเงินได้สุทธิ</th>
                    <th className="py-2.5 px-2 text-center">อัตรา</th>
                    <th className="py-2.5 px-3 text-right">เงินได้ในขั้น</th>
                    <th className="py-2.5 px-4 text-right">ภาษี</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {taxPlan.brackets.map((b) => {
                    const isMarginalTop =
                      b.ratePercent === taxPlan.marginalRatePercent &&
                      taxPlan.netTaxableIncome > 0 &&
                      b.taxableInBracket > 0;
                    return (
                      <tr
                        key={b.id}
                        className={
                          isMarginalTop
                            ? 'bg-sky-50/80 dark:bg-sky-950/35 font-semibold'
                            : b.taxableInBracket > 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'opacity-55'
                        }
                      >
                        <td className="py-2.5 px-4 text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {b.label}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono tabular-nums text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {b.ratePercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatMoney(b.taxableInBracket)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatMoney(b.taxInBracket)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm">
                    <td colSpan={2} className="py-3 px-4 text-slate-900 dark:text-white">
                      รวมภาษีที่คำนวณได้ทั้งปี
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatMoney(taxPlan.netTaxableIncome)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-700 dark:text-sky-400 whitespace-nowrap">
                      {formatMoney(taxPlan.totalComputedTax)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Concise Tax Calculation Summary Sheet */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs sm:text-sm">
            <h4 className="font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-slate-500" />
              <span>สรุปรายการคำนวณภาษีเงินได้บุคคลธรรมดา</span>
            </h4>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-300">เงินได้พึงประเมินรวม (12 เดือน + โบนัส)</span>
              <span className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatMoney(taxPlan.totalAnnualGrossIncome)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-300">หัก ค่าใช้จ่าย 50% (สูงสุด 100,000)</span>
              <span className="font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {formatMoney(taxPlan.expenseDeduction, { prefix: '-฿' })}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-300">หัก ค่าลดหย่อนกลุ่มส่วนตัวและครอบครัว</span>
              <span className="font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(taxPlan.familyDeductionsTotal, { prefix: '-฿' })}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-300">หัก ค่าลดหย่อนกลุ่มประกันและกองทุน</span>
              <span className="font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(taxPlan.insuranceAndFundsTotal, { prefix: '-฿' })}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-300">หัก ค่าลดหย่อนดอกเบี้ย กระตุ้นเศรษฐกิจ และบริจาค</span>
              <span className="font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(taxPlan.stimulusAndDonationsTotal, { prefix: '-฿' })}
              </span>
            </div>
            <div className="flex justify-between pt-2.5 border-t border-slate-200 dark:border-slate-800 font-bold">
              <span className="text-slate-900 dark:text-white">เงินได้สุทธิเพื่อเสียภาษี</span>
              <span className="font-mono tabular-nums text-sky-700 dark:text-sky-400">
                {formatMoney(taxPlan.netTaxableIncome)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. 12-Month Gross Income & Withholding Tax Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-500 shrink-0" />
              <span>บันทึกรายได้และภาษีหัก ณ ที่จ่ายทั้ง 12 เดือน (ปี {selectedYear})</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              คลิกที่ตัวเลขในคอลัมน์ &ldquo;ภาษีหัก ณ ที่จ่าย&rdquo; เพื่อแก้ไขรายเดือน หรือกดซิงค์จากคลังสลิปเงินเดือนทั้งปีอัตโนมัติ
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isSyncingFromSlips}
              onClick={handleSyncFromPaySlipVault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              {isSyncingFromSlips ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>
                ซิงค์จากคลังสลิป ({yearSlipSync.uniqueCycleCount} เดือน)
              </span>
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              รวมภาษีหัก ณ ที่จ่าย:{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatMoney(taxPlan.totalWithholdingTaxPaid)}
              </strong>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">รอบเดือน</th>
                <th className="py-3 px-3">ช่วงวันที่</th>
                <th className="py-3 px-3 text-right">ฐานเงินเดือน</th>
                <th className="py-3 px-3 text-right">ค่า OT</th>
                <th className="py-3 px-3 text-right">ค่ากะ / สวัสดิการ</th>
                <th className="py-3 px-3 text-right">เงินได้รวมรอบ</th>
                <th className="py-3 px-3 text-right">ปกส. / กองทุน</th>
                <th className="py-3 px-4 text-right">ภาษีหัก ณ ที่จ่าย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {taxPlan.monthlyRows.map((row) => {
                const isEditing = editingTaxCycleKey === row.cycleKey;
                return (
                  <tr
                    key={row.cycleKey}
                    className={`transition-colors ${
                      row.isBeforeWorkStart
                        ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40'
                        : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {row.monthName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {row.cycleKey} ·{' '}
                        {row.isBeforeWorkStart
                          ? 'ก่อนเริ่มงาน'
                          : row.isRecorded
                          ? 'บันทึกแล้ว'
                          : 'คาดการณ์ฐาน'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono tabular-nums">
                      {row.cyclePeriodLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatMoney(row.baseSalary)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {formatMoney(row.otAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatMoney(row.allowancesAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatMoney(row.grossIncome)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatMoney(row.socialSecurity)} / {formatMoney(row.providentFund)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {isEditing && !isMoneyHidden ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editingTaxValue}
                            placeholder="0.00"
                            onChange={(e) => setEditingTaxValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitCycleTax(row.cycleKey);
                              if (e.key === 'Escape') setEditingTaxCycleKey(null);
                            }}
                            className="w-24 px-2 py-1 rounded-lg border border-sky-500 bg-white dark:bg-slate-800 text-right text-xs font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCommitCycleTax(row.cycleKey)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            บันทึก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isMoneyHidden}
                          onClick={() => {
                            if (isMoneyHidden) return;
                            setEditingTaxCycleKey(row.cycleKey);
                            setEditingTaxValue(row.taxPaid > 0 ? String(row.taxPaid) : '');
                          }}
                          title={
                            isMoneyHidden
                              ? 'ปิดโหมดซ่อนเงินเพื่อดูหรือแก้ไขภาษี'
                              : 'คลิกเพื่อแก้ไขภาษีหัก ณ ที่จ่ายของเดือนนี้'
                          }
                          className={`group inline-flex items-center gap-1.5 font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 ${
                            isMoneyHidden
                              ? 'cursor-default opacity-80'
                              : 'hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer'
                          }`}
                        >
                          <span>{formatMoney(row.taxPaid)}</span>
                          {!isMoneyHidden && (
                            <Pencil className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs sm:text-sm">
                <td colSpan={2} className="py-3 px-4 text-slate-900 dark:text-white">
                  รวมทั้งปี {selectedYear} (12 รอบบิล)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {formatMoney(totalBaseSalarySum)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  {formatMoney(totalOtSum)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {formatMoney(totalAllowancesSum)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                  {formatMoney(taxPlan.cycleGrossIncomeTotal)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {formatMoney(totalAutoSsoSum)} / {formatMoney(totalAutoPvdSum)}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  {formatMoney(taxPlan.totalWithholdingTaxPaid)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
