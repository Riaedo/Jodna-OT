import React, { useState, useMemo, useEffect } from 'react';
import { DailyRecord, Holiday, PaySlipAttachment, PayrollSettings, PayrollSummary, SalaryIncrementRecord, TaxDeductionConfig } from '../types/overtime';
import { 
  calculatePayroll, 
  createCycleRecords, 
  formatCurrency, 
  getEffectiveSalaryForCycle,
  getCycleForDate,
  getLatestCycleAndDate
} from '../utils/calculator';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  DollarSign, 
  Clock, 
  Receipt, 
  Calendar, 
  CalendarDays,
  CalendarCheck,
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  FileSpreadsheet, 
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  FileImage,
  Calculator
} from 'lucide-react';
import { SalaryIncrementSection } from './SalaryIncrementSection';
import { YearlyLeaveView } from './YearlyLeaveView';
import { HolidayCalendar } from './HolidayCalendar';
import { PaySlipVaultView } from './PaySlipVaultView';
import { TaxCalculatorView } from './TaxCalculatorView';
import { calculateAnnualTaxPlan } from '../utils/taxCalculator';
import { useMoneyVisibility } from '../context/MoneyVisibilityContext';

export type OverallModule = 'hub' | 'annual_records' | 'salary_increment' | 'yearly_leave' | 'holidays' | 'payslip_vault' | 'tax_calculator';

interface YearlyDashboardProps {
  allCycleRecords: Record<string, DailyRecord[]>;
  cycleTaxes: Record<string, number>;
  settings: PayrollSettings;
  salaryIncrements?: SalaryIncrementRecord[];
  onUpdateSalaryIncrements?: (records: SalaryIncrementRecord[]) => void;
  onUpdateCycleTax?: (cycleKey: string, tax: number, silent?: boolean) => Promise<void> | void;
  onBatchUpdateCycleTaxes?: (updates: Record<string, number>, options?: { silent?: boolean }) => Promise<void> | void;
  onNavigateToCycle?: (year: number, month: number) => void;
  onUpdateBaseSalary?: (newSalary: number) => void;
  resetToHubSignal?: number;
  requestedModule?: { module: OverallModule; nonce: number } | null;
  minYear?: number;
  maxYear?: number;
  holidays: Holiday[];
  onAddHoliday: (holiday: Omit<Holiday, 'id'>) => void;
  onUpdateHoliday: (holiday: Holiday) => void;
  onDeleteHoliday: (id: string) => void;
  onApplyHolidaysToCurrentCycle: () => void;
  onCopyHolidaysFromYear?: (sourceYear: number, targetYear: number) => Promise<void> | void;
  paySlips?: PaySlipAttachment[];
  currentCycleKey?: string;
  currentCycleNetIncome?: number;
  onSavePaySlip?: (slip: PaySlipAttachment) => Promise<void> | void;
  onDeletePaySlip?: (slipId: string) => Promise<void> | void;
  onUpdateYearlyTaxDeductions?: (year: number, config: TaxDeductionConfig, silent?: boolean) => Promise<void> | void;
  onNotify?: (message: string) => void;
}

interface MonthlyCycleSummary {
  cycleKey: string;
  monthIndex: number; // 0-11
  year: number;
  monthName: string;
  cyclePeriodLabel: string;
  baseSalary: number;
  summary: PayrollSummary;
  netIncome: number;
  incomeBeforeTax: number;
  otAmount: number;
  otHours: number;
  taxPaid: number;
  leaveJ: number; // Vacation
  leaveE: number; // Sick
  leaveD: number; // Personal
  isRecorded: boolean;
}

interface YearSummaryData {
  year: number;
  totalNetIncome: number;
  totalIncomeBeforeTax: number;
  totalOtAmount: number;
  totalOtHours: number;
  totalTaxPaid: number;
  totalLeaveJ: number;
  totalLeaveE: number;
  totalLeaveD: number;
  totalLeaveDays: number;
  cycles: MonthlyCycleSummary[];
}

export const YearlyDashboard: React.FC<YearlyDashboardProps> = ({
  allCycleRecords,
  cycleTaxes,
  settings,
  salaryIncrements,
  onUpdateSalaryIncrements,
  onUpdateCycleTax,
  onBatchUpdateCycleTaxes,
  onNavigateToCycle,
  onUpdateBaseSalary,
  resetToHubSignal,
  requestedModule,
  minYear,
  maxYear,
  holidays,
  onAddHoliday,
  onUpdateHoliday,
  onDeleteHoliday,
  onApplyHolidaysToCurrentCycle,
  onCopyHolidaysFromYear,
  paySlips = [],
  currentCycleKey = '2026-10',
  currentCycleNetIncome = 0,
  onSavePaySlip,
  onDeletePaySlip,
  onUpdateYearlyTaxDeductions,
  onNotify,
}) => {
  const { isMoneyHidden, formatMoney } = useMoneyVisibility();
  const hasWorkStartDate = Boolean(settings.workStartDate && settings.workStartDate.trim() !== '');

  const [activeModule, setActiveModule] = useState<OverallModule>(() =>
    requestedModule?.module ? requestedModule.module : 'hub'
  );

  useEffect(() => {
    if (resetToHubSignal && resetToHubSignal > 0) {
      setActiveModule('hub');
    }
  }, [resetToHubSignal]);

  useEffect(() => {
    if (requestedModule && requestedModule.nonce > 0) {
      setActiveModule(requestedModule.module);
    }
  }, [requestedModule]);

  // 3. วันที่ รอบเดือน รอบปี ต่างๆ ให้เริ่มแสดงจากวันที่เริ่มทำงาน และแสดงจนถึงวันที่ รอบเดือน รอบปี ล่าสุดเท่านั้น
  const { startCycle, latestCycle } = useMemo(() => {
    if (!hasWorkStartDate) {
      return {
        startCycle: { year: 2026, month: 9, cycleKey: '2026-10' },
        latestCycle: { year: 2026, month: 9, cycleKey: '2026-10' },
      };
    }
    const start = getCycleForDate(settings.workStartDate!, settings.cycleStartDay, settings.cycleEndDay);
    const latest = getLatestCycleAndDate(settings.cycleStartDay, settings.cycleEndDay, Object.keys(allCycleRecords));
    return { startCycle: start, latestCycle: latest };
  }, [hasWorkStartDate, settings.workStartDate, settings.cycleStartDay, settings.cycleEndDay, allCycleRecords]);

  // Dynamic years strictly bounded from startCycle.year up to latestCycle.year
  const years = useMemo(() => {
    if (!hasWorkStartDate) return [];
    const startY = startCycle.year;
    const endY = Math.max(startY, latestCycle.year);
    const list: number[] = [];
    for (let y = startY; y <= endY; y++) {
      list.push(y);
    }
    return list;
  }, [hasWorkStartDate, startCycle.year, latestCycle.year]);

  // Filter state: selected year ('all' or specific year)
  const [selectedYearFilter, setSelectedYearFilter] = useState<number | 'all'>('all');
  
  // Expanded year row in the main table to view monthly drill-down
  const [expandedYear, setExpandedYear] = useState<number | null>(() => {
    return latestCycle.year || 2026;
  });

  useEffect(() => {
    if (years.length > 0 && (!expandedYear || !years.includes(expandedYear))) {
      setExpandedYear(years[years.length - 1]);
    }
  }, [years, expandedYear]);

  // Editing tax in monthly breakdown modal/row
  const [editingCycleKey, setEditingCycleKey] = useState<string | null>(null);
  const [editingTaxInput, setEditingTaxInput] = useState<string>('');

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const fullThaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Calculate annual summary data for each year
  const yearlySummaries: YearSummaryData[] = useMemo(() => {
    if (!hasWorkStartDate || years.length === 0) return [];

    return years.map((year) => {
      const cycles: MonthlyCycleSummary[] = [];

      for (let m = 0; m < 12; m++) {
        // Exclude months before work start date cycle
        if (year === startCycle.year && m < startCycle.month) continue;
        // Exclude months after latest cycle
        if (year === latestCycle.year && m > latestCycle.month) continue;

        const cycleKey = `${year}-${String(m + 1).padStart(2, '0')}`;
        const hasCustomRecords = allCycleRecords[cycleKey] && allCycleRecords[cycleKey].length > 0;
        
        let records: DailyRecord[];
        if (hasCustomRecords) {
          records = allCycleRecords[cycleKey];
        } else {
          // Generate baseline records with shift rotation
          records = createCycleRecords(year, m, settings);
        }

        // Distinct per-cycle tax and dynamic base salary for this specific month
        const effectiveSalary = getEffectiveSalaryForCycle(year, m, salaryIncrements || [], settings.baseSalary);
        const cycleTax = cycleTaxes[cycleKey] ?? 0;
        const summary = calculatePayroll(records, {
          ...settings,
          baseSalary: effectiveSalary,
          taxPaid: cycleTax,
        });

        const prevMonthIndex = m === 0 ? 11 : m - 1;
        const prevMonthYear = m === 0 ? year - 1 : year;
        const cyclePeriodLabel = `${settings.cycleStartDay} ${thaiMonths[prevMonthIndex]} ${prevMonthYear} - ${settings.cycleEndDay} ${thaiMonths[m]} ${year}`;

        cycles.push({
          cycleKey,
          monthIndex: m,
          year,
          monthName: fullThaiMonths[m],
          cyclePeriodLabel,
          baseSalary: effectiveSalary,
          summary,
          netIncome: summary.netIncome,
          incomeBeforeTax: summary.incomeBeforeTax,
          otAmount: summary.totalOtAmount,
          otHours: summary.totalOtHours,
          taxPaid: cycleTax,
          leaveJ: summary.vacationLeaveCount,
          leaveE: summary.sickLeaveCount,
          leaveD: summary.personalLeaveCount,
          isRecorded: hasCustomRecords,
        });
      }

      const totalNetIncome = cycles.reduce((acc, c) => acc + c.netIncome, 0);
      const totalIncomeBeforeTax = cycles.reduce((acc, c) => acc + c.incomeBeforeTax, 0);
      const totalOtAmount = cycles.reduce((acc, c) => acc + c.otAmount, 0);
      const totalOtHours = cycles.reduce((acc, c) => acc + c.otHours, 0);
      const totalTaxPaid = cycles.reduce((acc, c) => acc + c.taxPaid, 0);
      const totalLeaveJ = cycles.reduce((acc, c) => acc + c.leaveJ, 0);
      const totalLeaveE = cycles.reduce((acc, c) => acc + c.leaveE, 0);
      const totalLeaveD = cycles.reduce((acc, c) => acc + c.leaveD, 0);
      const totalLeaveDays = totalLeaveJ + totalLeaveE + totalLeaveD;

      return {
        year,
        totalNetIncome,
        totalIncomeBeforeTax,
        totalOtAmount,
        totalOtHours,
        totalTaxPaid,
        totalLeaveJ,
        totalLeaveE,
        totalLeaveD,
        totalLeaveDays,
        cycles,
      };
    });
  }, [years, allCycleRecords, cycleTaxes, settings, salaryIncrements]);

  // Aggregate KPI metrics based on filter
  const activeMetrics = useMemo(() => {
    if (selectedYearFilter === 'all') {
      const net = yearlySummaries.reduce((acc, y) => acc + y.totalNetIncome, 0);
      const beforeTax = yearlySummaries.reduce((acc, y) => acc + y.totalIncomeBeforeTax, 0);
      const ot = yearlySummaries.reduce((acc, y) => acc + y.totalOtAmount, 0);
      const otHours = yearlySummaries.reduce((acc, y) => acc + y.totalOtHours, 0);
      const tax = yearlySummaries.reduce((acc, y) => acc + y.totalTaxPaid, 0);
      const j = yearlySummaries.reduce((acc, y) => acc + y.totalLeaveJ, 0);
      const e = yearlySummaries.reduce((acc, y) => acc + y.totalLeaveE, 0);
      const d = yearlySummaries.reduce((acc, y) => acc + y.totalLeaveD, 0);
      return { net, beforeTax, ot, otHours, tax, j, e, d, label: 'รวม 3 ปี (2026 - 2028)' };
    } else {
      const target = yearlySummaries.find((y) => y.year === selectedYearFilter) || yearlySummaries[0];
      return {
        net: target.totalNetIncome,
        beforeTax: target.totalIncomeBeforeTax,
        ot: target.totalOtAmount,
        otHours: target.totalOtHours,
        tax: target.totalTaxPaid,
        j: target.totalLeaveJ,
        e: target.totalLeaveE,
        d: target.totalLeaveD,
        label: `ปี ค.ศ. ${target.year}`,
      };
    }
  }, [yearlySummaries, selectedYearFilter]);

  // Live summary for Card 6 (Annual Tax & Deductions Planner) on Hub
  const taxPreviewYear = latestCycle.year || new Date().getFullYear();
  const hubTaxSummary = useMemo(() => {
    const yearConfig = settings.yearlyTaxDeductions?.[taxPreviewYear];
    return calculateAnnualTaxPlan({
      year: taxPreviewYear,
      allCycleRecords,
      cycleTaxes,
      settings,
      salaryIncrements: salaryIncrements || [],
      configOverride: yearConfig,
    });
  }, [taxPreviewYear, allCycleRecords, cycleTaxes, settings, salaryIncrements]);

  // Export annual table to CSV
  const handleExportYearlyCsv = () => {
    const headers = [
      'ปี (Year)',
      'เงินได้สุทธิ (Net Income)',
      'เงินได้ก่อนหักภาษี (Income Before Tax)',
      'ค่าโอที (Total OT)',
      'ภาษีที่จ่าย (Tax Paid)',
      'ลา J (พักร้อน)',
      'ลา E (ป่วย)',
      'ลา D (กิจ)'
    ];

    const rows = yearlySummaries.map((y) => [
      y.year,
      y.totalNetIncome.toFixed(2),
      y.totalIncomeBeforeTax.toFixed(2),
      y.totalOtAmount.toFixed(2),
      y.totalTaxPaid.toFixed(2),
      y.totalLeaveJ,
      y.totalLeaveE,
      y.totalLeaveD
    ].join(','));

    // Total row
    const totalRow = [
      '"รวมทั้งสิ้น (Grand Total)"',
      yearlySummaries.reduce((acc, y) => acc + y.totalNetIncome, 0).toFixed(2),
      yearlySummaries.reduce((acc, y) => acc + y.totalIncomeBeforeTax, 0).toFixed(2),
      yearlySummaries.reduce((acc, y) => acc + y.totalOtAmount, 0).toFixed(2),
      yearlySummaries.reduce((acc, y) => acc + y.totalTaxPaid, 0).toFixed(2),
      yearlySummaries.reduce((acc, y) => acc + y.totalLeaveJ, 0),
      yearlySummaries.reduce((acc, y) => acc + y.totalLeaveE, 0),
      yearlySummaries.reduce((acc, y) => acc + y.totalLeaveD, 0),
    ].join(',');

    const csvContent = '\uFEFF' + [headers.join(','), ...rows, totalRow].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Yearly_Dashboard_${settings.employeeName}_2026_2028.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Close inline tax editor whenever Privacy Mode is activated
  useEffect(() => {
    if (isMoneyHidden) {
      setEditingCycleKey(null);
    }
  }, [isMoneyHidden]);

  // Save per-cycle tax update
  const handleSaveTax = (cycleKey: string) => {
    const val = Math.max(0, Number(editingTaxInput) || 0);
    if (onUpdateCycleTax) {
      onUpdateCycleTax(cycleKey, val);
    }
    setEditingCycleKey(null);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {activeModule === 'hub' ? (
        /* Dual Cards Hub (แถวละ 2 การ์ดบน PC/Tablet, 1 การ์ดบนมือถือ รวม 4 การ์ด) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Card 1: Annual Financial & Attendance Records */}
          <button
            type="button"
            onClick={() => setActiveModule('annual_records')}
            className="w-full bg-slate-900/90 border border-indigo-500/60 hover:border-indigo-400 shadow-lg shadow-indigo-500/10 rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <div className="shrink-0 p-3 sm:p-3.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 group-hover:bg-indigo-500/30 transition-colors">
              <LayoutDashboard className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  1. บันทึกการทำงานและรายได้ประจำปี{' '}
                  <span className="text-indigo-400 font-semibold block sm:inline">
                    (ANNUAL FINANCIAL &amp; ATTENDANCE RECORDS)
                  </span>
                </h3>
                <ArrowRight className="w-4 h-4 text-indigo-400/70 group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                สรุปเงินได้สุทธิ ค่าโอที ภาษี และสถิติวันลา 12 รอบวิก
              </p>
            </div>
          </button>

          {/* Card 2: Salary Increment */}
          <button
            type="button"
            onClick={() => setActiveModule('salary_increment')}
            className="w-full bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 shadow-lg hover:shadow-emerald-500/10 rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="shrink-0 p-3 sm:p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <TrendingUp className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  2. บันทึกการเพิ่มของเงินเดือน{' '}
                  <span className="text-emerald-400 font-semibold">(Salary Increment)</span>
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                ปรับฐานเงินเดือนตามช่วงเดือนอัตโนมัติ
              </p>
              <div className="mt-2.5">
                <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ปรับฐานเงินเดือนตามช่วงเดือนอัตโนมัติ
                </span>
              </div>
            </div>
          </button>

          {/* Card 3: Yearly Leave Records */}
          <button
            type="button"
            onClick={() => setActiveModule('yearly_leave')}
            className="w-full bg-slate-900/90 border border-slate-800 hover:border-purple-500/60 shadow-lg hover:shadow-purple-500/10 rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <div className="shrink-0 p-3 sm:p-3.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <CalendarDays className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  3. บันทึกสถิติการลาประจำปี{' '}
                  <span className="text-purple-400 font-semibold">(Annual Leave Records)</span>
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                ตรวจสอบวันลาพักร้อน (J) ลาป่วย (E) ลากิจ (D) และโควต้าวันลารอบปี
              </p>
            </div>
          </button>

          {/* Card 4: Annual Holidays */}
          <button
            type="button"
            onClick={() => setActiveModule('holidays')}
            className="w-full bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 shadow-lg hover:shadow-amber-500/10 rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <div className="shrink-0 p-3 sm:p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <CalendarCheck className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  4. ปฏิทินวันหยุดประจำปี{' '}
                  <span className="text-amber-400 font-semibold">(Annual Holidays)</span>
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                จัดการวันหยุดประจำปี คัดลอกต้นแบบข้ามปี และนำไปใช้กับรอบวิกปัจจุบัน
              </p>
            </div>
          </button>

          {/* Card 5: PaySlip Photo Vault & PDF Report */}
          <button
            type="button"
            onClick={() => setActiveModule('payslip_vault')}
            className="w-full bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 shadow-lg hover:shadow-cyan-500/10 rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <div className="shrink-0 p-3 sm:p-3.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
              <FileImage className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  5. บันทึกภาพถ่ายสลิปเงินเดือน &amp; PDF{' '}
                  <span className="text-cyan-400 font-semibold">(PaySlip Photo Vault &amp; PDF)</span>
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                ถ่ายภาพหรืออัปโหลดสลิปเงินเดือนแยกตามรอบเดือน เปิดดูย้อนหลังและดาวน์โหลดเป็นไฟล์ PDF ขนาด A4
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  บันทึกแล้ว {paySlips.length} ใบ
                </span>
                <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  รองรับกล้องมือถือ &amp; ส่งออก PDF
                </span>
              </div>
            </div>
          </button>

          {/* Card 6: Annual Tax & Deductions Calculator */}
          <button
            type="button"
            onClick={() => setActiveModule('tax_calculator')}
            className="w-full bg-slate-900/90 border border-slate-800 hover:border-rose-500/60 shadow-lg hover:shadow-rose-500/10 rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <div className="shrink-0 p-3 sm:p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
              <Calculator className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  6. คำนวณภาษีและค่าลดหย่อนประจำปี{' '}
                  <span className="text-rose-400 font-semibold">(Tax &amp; Deductions Planner)</span>
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                คำนวณภาษีเงินได้บุคคลธรรมดาแบบขั้นบันได 0-35% พร้อมวางแผนค่าลดหย่อนอัตโนมัติจากรายได้ 12 เดือน
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 tabular-nums">
                  หัก ณ ที่จ่ายปี {taxPreviewYear}: {formatMoney(hubTaxSummary.totalWithholdingTaxPaid)}
                </span>
                {hubTaxSummary.settlementStatus === 'REFUND' ? (
                  <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular-nums">
                    มีสิทธิขอคืนภาษี +{formatMoney(Math.abs(hubTaxSummary.settlementDiff))}
                  </span>
                ) : hubTaxSummary.settlementStatus === 'PAYABLE' ? (
                  <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 tabular-nums">
                    ต้องจ่ายเพิ่ม {formatMoney(Math.abs(hubTaxSummary.settlementDiff))}
                  </span>
                ) : (
                  <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    พอดี / ไม่ต้องเสียภาษีเพิ่ม
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>
      ) : (
        <>
          {/* Top Sub-View Navigation Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveModule('hub')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับหน้าเมนู Overall</span>
            </button>

            {/* Quick Module Switcher across all 4 systems */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 lg:pb-0">
              <button
                type="button"
                onClick={() => setActiveModule('annual_records')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'annual_records'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>รายได้ประจำปี</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('salary_increment')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'salary_increment'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-300'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>ปรับเงินเดือน</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('yearly_leave')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'yearly_leave'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-purple-50 dark:bg-slate-800 dark:hover:bg-purple-950/60 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>สถิติการลา</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('holidays')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'holidays'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-amber-950/60 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>วันหยุดประจำปี</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('payslip_vault')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'payslip_vault'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-950/60 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300'
                }`}
              >
                <FileImage className="w-3.5 h-3.5" />
                <span>ภาพสลิป &amp; PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule('tax_calculator')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeModule === 'tax_calculator'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>คำนวณภาษีประจำปี</span>
              </button>
            </div>
          </div>

          {activeModule === 'annual_records' && (
            <>
              {/* 1. Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-indigo-500/20 shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 sm:p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
              <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-indigo-300">
              ระบบแดชบอร์ดสรุปประจำปี (Annual Financial & Attendance Records)
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white mt-1.5 sm:mt-2">
            บันทึกการทำงานและรายได้ประจำปี {years.length > 0 ? `(ปี ค.ศ. ${years[0]}${years.length > 1 ? ` - ${years[years.length - 1]}` : ''})` : ''}
          </h2>
          <p className="text-[11px] sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            แสดงสรุปตารางเงินได้สุทธิ เงินได้ก่อนหักภาษี ค่าโอที ภาษีที่จ่าย และสถิติวันลา (ลา J, ลา E, ลา D) ตามรอบปี ค.ศ. พร้อมเจาะลึก 12 รอบวิก
          </p>
        </div>

        {/* Action Controls & Year Filter */}
        {hasWorkStartDate && (
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center bg-slate-800/80 p-0.5 sm:p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setSelectedYearFilter('all')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedYearFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ทั้งหมด
              </button>
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYearFilter(y)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedYearFilter === y
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportYearlyCsv}
              title="ดาวน์โหลดตารางสรุปประจำปีเป็นไฟล์ CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        )}
      </div>

      {!hasWorkStartDate ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto space-y-4 my-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
              ยังไม่ได้ระบุวันเริ่มทำงาน
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              ในส่วนรอบปีและสถิติรายปีจะคืนค่าเป็นว่างไว้ กรุณาระบุวันเริ่มทำงานในเมนู "ตั้งค่า" เพื่อเริ่มคำนวณและแสดงผลรอบปี
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 2. Top KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* Card 1: เงินได้สุทธิ */}
        <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white border border-indigo-700/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-indigo-300 flex items-center gap-1 sm:gap-1.5">
              <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="truncate">เงินได้สุทธิรวม</span>
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {activeMetrics.label}
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-white flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold text-emerald-400">฿</span>
              <span className="text-emerald-300 tabular-nums font-mono truncate">{formatMoney(activeMetrics.net, { prefix: '' })}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 truncate font-mono tabular-nums">
              หักภาษี {formatMoney(activeMetrics.tax)} แล้ว
            </p>
          </div>
        </div>

        {/* Card 2: เงินได้ก่อนหักภาษี */}
        <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5">
              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="truncate">ก่อนหักภาษี</span>
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Before Tax
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold text-slate-400">฿</span>
              <span className="tabular-nums font-mono truncate">{formatMoney(activeMetrics.beforeTax, { prefix: '' })}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              ฐานเงินเดือน + โอที + ค่ากะ
            </p>
          </div>
        </div>

        {/* Card 3: ค่าโอทีสะสม */}
        <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
              <span className="truncate">ค่าโอทีสะสม</span>
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {activeMetrics.otHours}h
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400 flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold">฿</span>
              <span className="tabular-nums font-mono truncate">{formatMoney(activeMetrics.ot, { prefix: '' })}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              รวมชั่วโมง OT ทั้งปี
            </p>
          </div>
        </div>

        {/* Card 4: ภาษีที่จ่ายสะสม & สถิติวันลา */}
        <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-rose-500" />
              <span className="truncate">ภาษีที่จ่ายสะสม</span>
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              Tax Paid
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2">
            <div className="text-base xs:text-lg sm:text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 flex items-baseline gap-0.5 truncate">
              <span className="text-xs sm:text-base font-bold">฿</span>
              <span className="tabular-nums font-mono truncate">{formatMoney(activeMetrics.tax, { prefix: '' })}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 sm:gap-2 truncate">
              <span>J: {activeMetrics.j}ว</span>
              <span>•</span>
              <span>E: {activeMetrics.e}ว</span>
              <span>•</span>
              <span>D: {activeMetrics.d}ว</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Primary Annual Summary Table & Mobile Card View */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        
        {/* Table Title Bar */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                ตารางบันทึกประจำปี (Annual Overtime & Leave Matrix)
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Template สเปรดชีต
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              คลิกที่แต่ละแถวปีเพื่อขยายดูรายละเอียด 12 รอบวิก (Monthly Cycles) และแก้ไขภาษีที่จ่ายแยกรายเดือน
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
            <span>ลา J: พักร้อน</span>
            <span>•</span>
            <span>ลา E: ลาป่วย</span>
            <span>•</span>
            <span>ลา D: ลากิจ</span>
          </div>
        </div>

        {/* 3A. Dedicated Mobile Card View (For small screens < 768px) */}
        <div className="block md:hidden p-2.5 space-y-3">
          {yearlySummaries
            .filter((y) => selectedYearFilter === 'all' || y.year === selectedYearFilter)
            .map((row) => {
              const isExpanded = expandedYear === row.year;
              const isCurrentYear = row.year === 2026;

              return (
                <div
                  key={`mob-year-${row.year}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-xs"
                >
                  {/* Mobile Year Card Header */}
                  <div
                    onClick={() => setExpandedYear(isExpanded ? null : row.year)}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer border-b border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 dark:text-white tabular-nums font-mono">
                        ปี ค.ศ. {row.year}
                      </span>
                      {isCurrentYear && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          ปีปัจจุบัน
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                      <span>{isExpanded ? 'ย่อรายละเอียด' : 'ดู 12 รอบวิก'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Mobile 2x2 Metric Grid */}
                  <div className="p-3 grid grid-cols-2 gap-2 text-xs border-b border-slate-100 dark:border-slate-800">
                    <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-200/50 dark:border-emerald-900/40">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium block">เงินได้สุทธิ</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-mono block">
                        {formatMoney(row.totalNetIncome)}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">เงินได้ก่อนหักภาษี</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums font-mono block">
                        {formatMoney(row.totalIncomeBeforeTax)}
                      </span>
                    </div>

                    <div className="bg-amber-50/40 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/50 dark:border-amber-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">ค่าโอที</span>
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">{row.totalOtHours}h</span>
                      </div>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums font-mono block">
                        {formatMoney(row.totalOtAmount)}
                      </span>
                    </div>

                    <div className="bg-rose-50/40 dark:bg-rose-950/20 p-2 rounded-lg border border-rose-200/50 dark:border-rose-900/40">
                      <span className="text-[10px] text-rose-700 dark:text-rose-300 font-medium block">ภาษีที่จ่าย</span>
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono block">
                        {formatMoney(row.totalTaxPaid)}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Leave Badges Strip */}
                  <div className="px-3 py-2 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">วันลารวม:</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                        ลา J: {row.totalLeaveJ}ว
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                        ลา E: {row.totalLeaveE}ว
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                        ลา D: {row.totalLeaveD}ว
                      </span>
                    </div>
                  </div>

                  {/* Mobile Expanded 12-Month Cards */}
                  {isExpanded && (
                    <div className="p-2.5 bg-slate-100/70 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          รายละเอียด 12 รอบวิก (ปี {row.year})
                        </span>
                        <span className="text-[10px] text-slate-500">แตะภาษีเพื่อแก้ไข</span>
                      </div>

                      <div className="space-y-2">
                        {row.cycles.map((c) => {
                          const isEditing = editingCycleKey === c.cycleKey;
                          return (
                            <div
                              key={`mob-cycle-${c.cycleKey}`}
                              className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                                    {c.monthName} ({c.cycleKey})
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">{c.cyclePeriodLabel}</span>
                                </div>

                                {onNavigateToCycle && (
                                  <button
                                    onClick={() => onNavigateToCycle(c.year, c.monthIndex)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold transition-all"
                                  >
                                    <span>ไปรอบนี้</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                  <span className="text-[9px] text-slate-400 block">สุทธิ</span>
                                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                                    {formatMoney(c.netIncome)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 block">โอที ({c.otHours}h)</span>
                                  <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums font-mono">
                                    {formatMoney(c.otAmount)}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-400 block">ภาษีที่จ่าย</span>
                                  {isEditing && !isMoneyHidden ? (
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={editingTaxInput}
                                        placeholder="0.00"
                                        onChange={(e) => setEditingTaxInput(e.target.value)}
                                        className="w-16 px-1 py-0.5 rounded border border-indigo-500 bg-white dark:bg-slate-800 text-right text-[10px] font-bold text-rose-500 focus:outline-none"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveTax(c.cycleKey);
                                          if (e.key === 'Escape') setEditingCycleKey(null);
                                        }}
                                      />
                                      <button
                                        onClick={() => handleSaveTax(c.cycleKey)}
                                        className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-bold"
                                      >
                                        เซฟ
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      disabled={isMoneyHidden}
                                      onClick={() => {
                                        if (isMoneyHidden) return;
                                        setEditingCycleKey(c.cycleKey);
                                        setEditingTaxInput(c.taxPaid ? String(c.taxPaid) : '');
                                      }}
                                      title={isMoneyHidden ? 'ปิดโหมดซ่อนเงินเพื่อดูหรือแก้ไขภาษี' : 'แตะเพื่อแก้ไขภาษี'}
                                      className={`font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono ${
                                        isMoneyHidden ? 'cursor-default opacity-90' : 'underline underline-offset-2'
                                      }`}
                                    >
                                      {isMoneyHidden ? formatMoney(c.taxPaid) : (c.taxPaid > 0 ? `฿${formatCurrency(c.taxPaid)}` : '฿0')}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <span>วันลา: J ({c.leaveJ}ว) • E ({c.leaveE}ว) • D ({c.leaveD}ว)</span>
                                <span className="text-slate-400 font-medium font-mono tabular-nums">ก่อนภาษี {formatMoney(c.incomeBeforeTax)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* 3B. Responsive Table Container (For Desktop/Tablet >= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[11px] sm:text-xs">
                <th className="py-3 px-3 sm:px-4">ปี</th>
                <th className="py-3 px-3 sm:px-4 text-right">เงินได้สุทธิ</th>
                <th className="py-3 px-3 sm:px-4 text-right">เงินได้ก่อนหักภาษี</th>
                <th className="py-3 px-3 sm:px-4 text-right">ค่าโอที</th>
                <th className="py-3 px-3 sm:px-4 text-right">ภาษีที่จ่าย</th>
                <th className="py-3 px-3 sm:px-4 text-center">ลา J</th>
                <th className="py-3 px-3 sm:px-4 text-center">ลา E</th>
                <th className="py-3 px-3 sm:px-4 text-center">ลา D</th>
                <th className="py-3 px-2 sm:px-3 text-center">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {yearlySummaries
                .filter((y) => selectedYearFilter === 'all' || y.year === selectedYearFilter)
                .map((row) => {
                  const isExpanded = expandedYear === row.year;
                  const isCurrentYear = row.year === 2026;

                  return (
                    <React.Fragment key={row.year}>
                      {/* Main Year Row */}
                      <tr 
                        onClick={() => setExpandedYear(isExpanded ? null : row.year)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                          isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        {/* 1. ปี (Year) */}
                        <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm sm:text-base font-black tabular-nums font-mono">
                              {row.year}
                            </span>
                            {isCurrentYear && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                ปีปัจจุบัน
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. เงินได้สุทธิ */}
                        <td className="py-3 px-3 sm:px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                          {formatMoney(row.totalNetIncome)}
                        </td>

                        {/* 3. เงินได้ก่อนหักภาษี */}
                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-slate-800 dark:text-slate-200 tabular-nums font-mono">
                          {formatMoney(row.totalIncomeBeforeTax)}
                        </td>

                        {/* 4. ค่าโอที */}
                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-amber-600 dark:text-amber-400 tabular-nums font-mono">
                          {formatMoney(row.totalOtAmount)}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            ({row.totalOtHours} ชม.)
                          </span>
                        </td>

                        {/* 5. ภาษีที่จ่าย */}
                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono">
                          {formatMoney(row.totalTaxPaid)}
                        </td>

                        {/* 6. ลา J (พักร้อน) */}
                        <td className="py-3 px-3 sm:px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs tabular-nums font-mono ${
                            row.totalLeaveJ > 0 
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' 
                              : 'text-slate-400'
                          }`}>
                            {row.totalLeaveJ}
                          </span>
                        </td>

                        {/* 7. ลา E (ลาป่วย) */}
                        <td className="py-3 px-3 sm:px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs tabular-nums font-mono ${
                            row.totalLeaveE > 0 
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' 
                              : 'text-slate-400'
                          }`}>
                            {row.totalLeaveE}
                          </span>
                        </td>

                        {/* 8. ลา D (ลากิจ) */}
                        <td className="py-3 px-3 sm:px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs tabular-nums font-mono ${
                            row.totalLeaveD > 0 
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' 
                              : 'text-slate-400'
                          }`}>
                            {row.totalLeaveD}
                          </span>
                        </td>

                        {/* Action Toggle */}
                        <td className="py-3 px-2 sm:px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedYear(isExpanded ? null : row.year);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={isExpanded ? 'ยุบรายละเอียด' : 'ดู 12 รอบวิก'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Drill-down: 12 Monthly Cycles of this year */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0 border-b border-indigo-200 dark:border-indigo-900/60">
                            <div className="bg-slate-50/90 dark:bg-slate-950/80 p-3 sm:p-5 border-y border-slate-200 dark:border-slate-800">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
                                <div>
                                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <span>รายละเอียดราย 12 รอบวิกของปี ค.ศ. {row.year}</span>
                                  </h4>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    คุณสามารถคลิกที่ปุ่มดินสอหรือตัวเลขภาษี เพื่อกำหนดค่าภาษีที่จ่ายไปของแต่ละรอบเดือนแยกกันได้อิสระ
                                  </p>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  ตัดรอบทุกวันที่: <strong className="text-slate-700 dark:text-slate-200">{settings.cycleStartDay} - {settings.cycleEndDay}</strong>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px] sm:text-xs">
                                  <thead>
                                    <tr className="text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
                                      <th className="py-2 px-2">รอบวิก</th>
                                      <th className="py-2 px-2">ช่วงวันที่</th>
                                      <th className="py-2 px-2 text-right">ฐานเงินเดือน</th>
                                      <th className="py-2 px-2 text-right">เงินได้สุทธิ</th>
                                      <th className="py-2 px-2 text-right">เงินได้ก่อนภาษี</th>
                                      <th className="py-2 px-2 text-right">ค่าโอที</th>
                                      <th className="py-2 px-2 text-right">ภาษีที่จ่าย (แยกรายเดือน)</th>
                                      <th className="py-2 px-2 text-center">ลา J</th>
                                      <th className="py-2 px-2 text-center">ลา E</th>
                                      <th className="py-2 px-2 text-center">ลา D</th>
                                      <th className="py-2 px-2 text-center">การกระทำ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                    {row.cycles.map((c) => {
                                      const isEditing = editingCycleKey === c.cycleKey;
                                      return (
                                        <tr key={c.cycleKey} className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                                          <td className="py-2 px-2 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                            {c.monthName} ({c.cycleKey})
                                          </td>
                                          <td className="py-2 px-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                            {c.cyclePeriodLabel}
                                          </td>
                                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                                            {formatMoney(c.baseSalary)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono whitespace-nowrap">
                                            {formatMoney(c.netIncome)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-bold text-slate-700 dark:text-slate-300 tabular-nums font-mono whitespace-nowrap">
                                            {formatMoney(c.incomeBeforeTax)}
                                          </td>
                                          <td className="py-2 px-2 text-right font-semibold text-amber-600 dark:text-amber-400 tabular-nums font-mono whitespace-nowrap">
                                            {formatMoney(c.otAmount)} <span className="text-[10px] text-slate-400">({c.otHours}h)</span>
                                          </td>

                                          {/* 3: ภาษีที่จ่ายไปให้แยกการใส่เป็นรอบเดือน */}
                                          <td className="py-2 px-2 text-right whitespace-nowrap">
                                            {isEditing && !isMoneyHidden ? (
                                              <div className="flex items-center justify-end gap-1">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="any"
                                                  value={editingTaxInput}
                                                  placeholder="0.00"
                                                  onChange={(e) => setEditingTaxInput(e.target.value)}
                                                  className="w-20 px-1.5 py-0.5 rounded border border-indigo-500 bg-white dark:bg-slate-800 text-right text-xs font-bold text-rose-500 focus:outline-none"
                                                  autoFocus
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveTax(c.cycleKey);
                                                    if (e.key === 'Escape') setEditingCycleKey(null);
                                                  }}
                                                />
                                                <button
                                                  onClick={() => handleSaveTax(c.cycleKey)}
                                                  className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                                                >
                                                  บันทึก
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                disabled={isMoneyHidden}
                                                onClick={() => {
                                                  if (isMoneyHidden) return;
                                                  setEditingCycleKey(c.cycleKey);
                                                  setEditingTaxInput(c.taxPaid ? String(c.taxPaid) : '');
                                                }}
                                                className={`group inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono ${
                                                  isMoneyHidden ? 'cursor-default' : 'hover:text-indigo-600'
                                                }`}
                                                title={isMoneyHidden ? 'ปิดโหมดซ่อนเงินเพื่อดูหรือแก้ไขภาษี' : 'คลิกเพื่อแก้ไขภาษีของรอบเดือนนี้'}
                                              >
                                                <span>{formatMoney(c.taxPaid)}</span>
                                                {!isMoneyHidden && (
                                                  <span className="text-[9px] opacity-0 group-hover:opacity-100 text-indigo-500 underline">
                                                    (แก้ไข)
                                                  </span>
                                                )}
                                              </button>
                                            )}
                                          </td>

                                          <td className="py-2 px-2 text-center tabular-nums font-mono">
                                            {c.leaveJ > 0 ? <span className="font-bold text-purple-600 dark:text-purple-400">{c.leaveJ}</span> : <span className="text-slate-300 dark:text-slate-600">-</span>}
                                          </td>
                                          <td className="py-2 px-2 text-center tabular-nums font-mono">
                                            {c.leaveE > 0 ? <span className="font-bold text-rose-600 dark:text-rose-400">{c.leaveE}</span> : <span className="text-slate-300 dark:text-slate-600">-</span>}
                                          </td>
                                          <td className="py-2 px-2 text-center tabular-nums font-mono">
                                            {c.leaveD > 0 ? <span className="font-bold text-amber-600 dark:text-amber-400">{c.leaveD}</span> : <span className="text-slate-300 dark:text-slate-600">-</span>}
                                          </td>

                                          <td className="py-2 px-2 text-center">
                                            {onNavigateToCycle && (
                                              <button
                                                onClick={() => onNavigateToCycle(c.year, c.monthIndex)}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-all"
                                                title="เปิดรอบนี้ในหน้าตารางเวลาหลัก"
                                              >
                                                <span>ไปรอบนี้</span>
                                                <ExternalLink className="w-2.5 h-2.5" />
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>

            {/* Total Summary Footer Row */}
            <tfoot>
              <tr className="bg-slate-100 dark:bg-slate-800/90 font-extrabold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 text-xs sm:text-sm">
                <td className="py-3.5 px-3 sm:px-4">
                  รวมทั้งสิ้น (Grand Total)
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-right text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                  {formatMoney(yearlySummaries.reduce((acc, y) => acc + y.totalNetIncome, 0))}
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-right tabular-nums font-mono">
                  {formatMoney(yearlySummaries.reduce((acc, y) => acc + y.totalIncomeBeforeTax, 0))}
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-right text-amber-600 dark:text-amber-400 tabular-nums font-mono">
                  {formatMoney(yearlySummaries.reduce((acc, y) => acc + y.totalOtAmount, 0))}
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-right text-rose-600 dark:text-rose-400 tabular-nums font-mono">
                  {formatMoney(yearlySummaries.reduce((acc, y) => acc + y.totalTaxPaid, 0))}
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-center tabular-nums font-mono text-purple-600 dark:text-purple-400">
                  {yearlySummaries.reduce((acc, y) => acc + y.totalLeaveJ, 0)}
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-center tabular-nums font-mono text-rose-600 dark:text-rose-400">
                  {yearlySummaries.reduce((acc, y) => acc + y.totalLeaveE, 0)}
                </td>
                <td className="py-3.5 px-3 sm:px-4 text-center tabular-nums font-mono text-amber-600 dark:text-amber-400">
                  {yearlySummaries.reduce((acc, y) => acc + y.totalLeaveD, 0)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
      </>
      )}

              {/* 5. Leave Quota & Policy Notice */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    สิทธิ์วันลาประจำปีที่กำหนดในระบบ: พักร้อน (J) <strong>{settings.leaveVacationQuota} วัน</strong> • ลาป่วย (E) <strong>{settings.leaveSickQuota} วัน</strong> • ลากิจ (D) <strong>{settings.leavePersonalQuota} วัน</strong>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  * เกณฑ์หักสวัสดิการ (ไม่นับวันลาพักร้อน): ค่ากะ หัก 1/3 (1 วัน), 2/3 (2 วัน), 100% (3 วัน+) • เบี้ยขยัน หัก 1/2 (1 วัน), 100% (2 วัน+)
                </div>
              </div>
            </>
          )}

          {activeModule === 'salary_increment' && (
            <SalaryIncrementSection
              salaryIncrements={salaryIncrements}
              onUpdateSalaryIncrements={onUpdateSalaryIncrements}
              settings={settings}
              onUpdateBaseSalary={onUpdateBaseSalary}
            />
          )}

          {activeModule === 'yearly_leave' && (
            <YearlyLeaveView
              allCycleRecords={allCycleRecords}
              settings={settings}
              minYear={minYear ?? startCycle.year}
              maxYear={maxYear ?? latestCycle.year}
            />
          )}

          {activeModule === 'holidays' && (
            <HolidayCalendar
              holidays={holidays}
              onAddHoliday={onAddHoliday}
              onUpdateHoliday={onUpdateHoliday}
              onDeleteHoliday={onDeleteHoliday}
              onApplyToCurrentCycle={onApplyHolidaysToCurrentCycle}
              onCopyHolidaysFromYear={onCopyHolidaysFromYear}
            />
          )}

          {activeModule === 'payslip_vault' && (
            <PaySlipVaultView
              paySlips={paySlips}
              allCycleRecords={allCycleRecords}
              salaryIncrements={salaryIncrements}
              cycleTaxes={cycleTaxes}
              settings={settings}
              currentCycleKey={currentCycleKey}
              currentCycleNetIncome={currentCycleNetIncome}
              onSavePaySlip={(slip) => (onSavePaySlip ? onSavePaySlip(slip) : undefined)}
              onDeletePaySlip={(slipId) => (onDeletePaySlip ? onDeletePaySlip(slipId) : undefined)}
              onUpdateCycleTax={onUpdateCycleTax}
              onNotify={onNotify}
            />
          )}

          {activeModule === 'tax_calculator' && (
            <TaxCalculatorView
              allCycleRecords={allCycleRecords}
              cycleTaxes={cycleTaxes}
              paySlips={paySlips}
              settings={settings}
              salaryIncrements={salaryIncrements}
              onUpdateCycleTax={onUpdateCycleTax}
              onBatchUpdateCycleTaxes={onBatchUpdateCycleTaxes}
              onUpdateYearlyTaxDeductions={onUpdateYearlyTaxDeductions}
              onNotify={onNotify}
            />
          )}
        </>
      )}

    </div>
  );
};
