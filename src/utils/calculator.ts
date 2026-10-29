import { DailyRecord, Holiday, PayrollSettings, PayrollSummary, ShiftGroup, ShiftPeriod, ShiftType, SalaryIncrementRecord } from '../types/overtime';

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Calculate 2-week Day / 2-week Night rotation.
 */
export function calculateShiftPeriod(
  dateStr: string,
  refDateStr = '2026-10-01',
  refPeriod: ShiftPeriod = 'DAY',
  shiftGroup: ShiftGroup = 'A'
): ShiftPeriod {
  const targetDate = new Date(dateStr + 'T00:00:00');
  const refDate = new Date(refDateStr + 'T00:00:00');
  
  const diffDays = Math.floor((targetDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const cycleWeek = ((diffWeeks % 4) + 4) % 4; // 0, 1, 2, 3

  let period: ShiftPeriod;
  if (refPeriod === 'DAY') {
    period = cycleWeek < 2 ? 'DAY' : 'NIGHT';
  } else {
    period = cycleWeek < 2 ? 'NIGHT' : 'DAY';
  }

  if (shiftGroup === 'B') {
    return period === 'DAY' ? 'NIGHT' : 'DAY';
  }
  return period;
}

/**
 * Check if a Saturday is an OFF Saturday for Shift A vs Shift B.
 * 1: สลับวันเสาร์หยุดระหว่าง shift a กับ shift b
 */
export function isSaturdayOffForGroup(dateStr: string, shiftGroup: ShiftGroup = 'A'): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getDay() !== 6) return false;

  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  // 1: สลับวันเสาร์หยุดระหว่าง Shift A และ Shift B (Shift A ได้ week คี่, Shift B ได้ week คู่)
  if (shiftGroup === 'A') {
    return weekNumber % 2 !== 0;
  } else {
    return weekNumber % 2 === 0;
  }
}

export function calculatePayroll(records: DailyRecord[], settings: PayrollSettings): PayrollSummary {
  const daysPerMonth = settings.daysPerMonth || 30;
  const hoursPerDay = settings.hoursPerDay || 8;

  const dailyRate = round2(settings.baseSalary / daysPerMonth);
  const hourlyRate = round2(dailyRate / hoursPerDay);

  const ot1_0_rate = round2(hourlyRate * 1.0);
  const ot1_5_rate = round2(hourlyRate * 1.5);
  const ot2_0_rate = round2(hourlyRate * 2.0);
  const ot3_0_rate = round2(hourlyRate * 3.0);

  let totalOt1_0_hours = 0;
  let totalOt1_5_hours = 0;
  let totalOt2_0_hours = 0;
  let totalOt3_0_hours = 0;

  let sickLeaveCount = 0;
  let personalLeaveCount = 0;
  let vacationLeaveCount = 0;
  let holidayCount = 0;
  let workDaysCount = 0;
  let dayShiftCount = 0;
  let nightShiftCount = 0;
  let dailyCustomAllowances = 0;

  records.forEach((r) => {
    // ข้ามวันก่อนเริ่มทำงาน
    if (r.isBeforeWorkStart) return;

    totalOt1_0_hours += Number(r.ot1_0) || 0;
    totalOt1_5_hours += Number(r.ot1_5) || 0;
    totalOt2_0_hours += Number(r.ot2_0) || 0;
    totalOt3_0_hours += Number(r.ot3_0) || 0;

    if (r.shiftType === 'E') {
      sickLeaveCount += 1;
    } else if (r.shiftType === 'D') {
      personalLeaveCount += 1;
    } else if (r.shiftType === 'J') {
      vacationLeaveCount += 1;
    } else if (r.shiftType === 'H') {
      holidayCount += 1;
    } else if (r.shiftType === 'NORMAL') {
      workDaysCount += 1;
      if (settings.shiftWorkEnabled) {
        if (r.shiftPeriod === 'NIGHT') {
          nightShiftCount += 1;
        } else {
          dayShiftCount += 1;
        }
      }
    }

    if (r.mealAllowance) dailyCustomAllowances += Number(r.mealAllowance);
    if (r.shiftAllowanceDay) dailyCustomAllowances += Number(r.shiftAllowanceDay);
  });

  const leaveDaysCount = sickLeaveCount + personalLeaveCount + vacationLeaveCount;

  totalOt1_0_hours = round2(totalOt1_0_hours);
  totalOt1_5_hours = round2(totalOt1_5_hours);
  totalOt2_0_hours = round2(totalOt2_0_hours);
  totalOt3_0_hours = round2(totalOt3_0_hours);
  const totalOtHours = round2(totalOt1_0_hours + totalOt1_5_hours + totalOt2_0_hours + totalOt3_0_hours);

  // OT Amounts
  const ot1_0_amount = round2(totalOt1_0_hours * ot1_0_rate);
  const ot1_5_amount = round2(totalOt1_5_hours * ot1_5_rate);
  const ot2_0_amount = round2(totalOt2_0_hours * ot2_0_rate);
  const ot3_0_amount = round2(totalOt3_0_hours * ot3_0_rate);
  const totalOtAmount = round2(ot1_0_amount + ot1_5_amount + ot2_0_amount + ot3_0_amount);

  // Diligence Allowance Calculation
  const baseDiligenceAmount = Number(settings.diligenceAmount) || 0;
  // User Request 4: หักเบี้ยขยัน โดยคิดจากวันลา โดยลา 1 วัน หัก 500
  const diligenceDeduction = baseDiligenceAmount > 0 ? round2(Math.min(baseDiligenceAmount, leaveDaysCount * 500)) : 0;
  const diligenceAmount = baseDiligenceAmount;

  // Shift Allowance Calculation:
  // User Request 5: เพิ่มหักค่าเข้ากะ โดยคิดจากวันลา โดยลา 1 วัน หัก 900
  let baseShiftAmount = 0;
  let shiftAllowanceDeduction = 0;
  if (settings.shiftWorkEnabled) {
    baseShiftAmount = Number(settings.shiftAmount) || 0;
    shiftAllowanceDeduction = baseShiftAmount > 0 ? round2(Math.min(baseShiftAmount, leaveDaysCount * 900)) : 0;
  }
  const shiftAmount = baseShiftAmount;

  // Fixed allowances (1: ตัดค่าอาหารออก ทั้งรายการได้และรายการหัก)
  const fixedHousing = Number(settings.housingAllowance) || 0;
  const fixedHardship = Number(settings.hardshipAllowance) || 0;
  const totalFixedAllowances = round2(
    fixedHousing + fixedHardship + dailyCustomAllowances
  );

  // Gross Income
  const totalGrossIncome = round2(
    settings.baseSalary +
    totalOtAmount +
    diligenceAmount +
    shiftAmount +
    totalFixedAllowances
  );

  // Deductions: Provident Fund
  const pfRate = settings.providentFundRate !== undefined ? Number(settings.providentFundRate) : 0;
  const providentFundAmount = round2(settings.baseSalary * pfRate);

  // Social Security: capped
  const ssoCalculated = settings.baseSalary * (settings.socialSecurityRate !== undefined ? Number(settings.socialSecurityRate) : 0.05);
  const ssoCap = settings.socialSecurityCap || 875;
  const socialSecurityAmount = round2(Math.min(ssoCalculated, ssoCap));

  // Deductions before tax (1: ตัดค่าอาหารออก)
  const otherDeductions = Number(settings.otherDeductions) || 0;
  const deductionsBeforeTax = round2(
    providentFundAmount +
    socialSecurityAmount +
    diligenceDeduction +
    shiftAllowanceDeduction +
    otherDeductions
  );

  // 2. เงินได้ก่อนหักภาษี (Income Before Tax)
  const incomeBeforeTax = round2(totalGrossIncome - deductionsBeforeTax);

  // 3. ภาษีที่จ่ายไป (Tax Paid) - from settings.taxPaid or taxRateEstimate
  let taxPaid = 0;
  if (settings.taxPaid !== undefined && settings.taxPaid !== null) {
    taxPaid = round2(Math.max(0, Number(settings.taxPaid) || 0));
  } else if (settings.taxRateEstimate && settings.taxRateEstimate > 0) {
    const taxableIncome = Math.max(0, totalGrossIncome - 5000);
    taxPaid = round2(taxableIncome * (settings.taxRateEstimate / 100));
  }
  const taxAmount = taxPaid;

  // Total deductions (deductions before tax + tax paid)
  const totalDeductions = round2(deductionsBeforeTax + taxPaid);

  // 3. เงินได้สุทธิ (Net Income) = เงินได้ก่อนหักภาษี - ค่าภาษีที่จ่ายไป
  const netIncome = round2(incomeBeforeTax - taxPaid);

  return {
    dailyRate,
    hourlyRate,
    ot1_0_rate,
    ot1_5_rate,
    ot2_0_rate,
    ot3_0_rate,

    totalOt1_0_hours,
    totalOt1_5_hours,
    totalOt2_0_hours,
    totalOt3_0_hours,
    totalOtHours,

    ot1_0_amount,
    ot1_5_amount,
    ot2_0_amount,
    ot3_0_amount,
    totalOtAmount,

    sickLeaveCount,
    personalLeaveCount,
    vacationLeaveCount,
    leaveDaysCount,
    holidayCount,
    workDaysCount,

    dayShiftCount,
    nightShiftCount,

    baseDiligenceAmount,
    diligenceDeduction,
    diligenceAmount,

    baseShiftAmount,
    shiftAllowanceDeduction,
    shiftAmount,

    totalFixedAllowances,
    totalGrossIncome,

    providentFundAmount,
    socialSecurityAmount,
    taxAmount,
    taxPaid,
    foodDeductionAmount: 0,
    otherDeductionsAmount: otherDeductions,
    deductionsBeforeTax,
    incomeBeforeTax,
    totalDeductions,
    netIncome,
  };
}

export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
  const checkDate = new Date(y, m, d);
  return (
    checkDate.getFullYear() === y &&
    checkDate.getMonth() === m &&
    checkDate.getDate() === d
  );
}

/**
 * Returns the cycle { year, month (0-11), cycleKey } for a specific date.
 * E.g., for startDay=20, endDay=19:
 * 2026-10-01 belongs to cycle 2026-10 (Sept 20 - Oct 19).
 * 2026-09-20 belongs to cycle 2026-10 (Sept 20 - Oct 19).
 */
export function getCycleForDate(
  dateStr: string,
  startDay = 20,
  endDay = 19
): { year: number; month: number; cycleKey: string } {
  if (!isValidDateString(dateStr)) {
    return { year: 2026, month: 9, cycleKey: '2026-10' };
  }
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-11
  const d = parseInt(parts[2], 10);

  let cycleYear = y;
  let cycleMonth = m;

  if (startDay > endDay) {
    if (d >= startDay) {
      cycleMonth += 1;
      if (cycleMonth > 11) {
        cycleMonth = 0;
        cycleYear += 1;
      }
    }
  }

  const cycleKey = `${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}`;
  return { year: cycleYear, month: cycleMonth, cycleKey };
}

/**
 * Returns the difference in months between two cycles (y2, m2) - (y1, m1).
 */
export function getMonthDiff(y1: number, m1: number, y2: number, m2: number): number {
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Returns the latest cycle and date according to today and existing recorded keys.
 */
export function getLatestCycleAndDate(
  startDay = 20,
  endDay = 19,
  recordedCycleKeys: string[] = []
): { year: number; month: number; cycleKey: string; latestDate: string } {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  let latest = getCycleForDate(todayStr, startDay, endDay);
  let latestDate = todayStr;

  recordedCycleKeys.forEach((key) => {
    const parts = key.split('-');
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        if (y > latest.year || (y === latest.year && m > latest.month)) {
          latest = { year: y, month: m, cycleKey: key };
        }
      }
    }
  });

  return { ...latest, latestDate };
}


export function generateCycleDates(year: number, month: number, startDay = 20, endDay = 19): string[] {
  const dates: string[] = [];
  
  const currentMonthTotalDays = new Date(year, month + 1, 0).getDate();

  // If cutoff spans across two months (e.g. 20th of prev month to 19th of current month)
  if (startDay > endDay) {
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear -= 1;
    }
    const prevMonthTotalDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    const effectiveStartDay = Math.min(startDay, prevMonthTotalDays);
    
    for (let d = effectiveStartDay; d <= prevMonthTotalDays; d++) {
      const padM = String(prevMonth + 1).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      dates.push(`${prevYear}-${padM}-${padD}`);
    }

    const effectiveEndDay = Math.min(endDay, currentMonthTotalDays);
    for (let d = 1; d <= effectiveEndDay; d++) {
      const padM = String(month + 1).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      dates.push(`${year}-${padM}-${padD}`);
    }
  } else {
    // Single month cycle (e.g. 1st to 30th/31st of the same month)
    const effectiveStartDay = Math.min(startDay, currentMonthTotalDays);
    const effectiveEndDay = Math.min(endDay, currentMonthTotalDays);
    for (let d = effectiveStartDay; d <= effectiveEndDay; d++) {
      const padM = String(month + 1).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      dates.push(`${year}-${padM}-${padD}`);
    }
  }

  return dates;
}

export function getDayOfWeekThai(dateStr: string): { en: string; th: string; isWeekend: boolean } {
  const d = new Date(dateStr + 'T00:00:00');
  const dayIndex = d.getDay();
  const enDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const thDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return {
    en: enDays[dayIndex],
    th: thDays[dayIndex],
    isWeekend: dayIndex === 0 || dayIndex === 6,
  };
}

export function createCycleRecords(
  year: number,
  month: number,
  settings: PayrollSettings,
  holidays: Holiday[] = []
): DailyRecord[] {
  const dateStrings = generateCycleDates(year, month, settings.cycleStartDay, settings.cycleEndDay);
  const holidayMap = new Map<string, Holiday>();
  holidays.forEach((h) => holidayMap.set(h.date, h));

  return dateStrings.map((dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayNumber = d.getDate();
    const dow = getDayOfWeekThai(dateStr);
    const isSunday = d.getDay() === 0;
    const isSaturday = d.getDay() === 6;

    const holiday = holidayMap.get(dateStr);

    let shiftPeriod: ShiftPeriod = 'DAY';
    let isSatOff = false;

    if (settings.shiftWorkEnabled) {
      shiftPeriod = calculateShiftPeriod(
        dateStr,
        settings.shiftReferenceDate,
        settings.shiftReferencePeriod,
        settings.shiftGroup
      );
    }

    if (isSaturday) {
      isSatOff = isSaturdayOffForGroup(dateStr, settings.shiftGroup);
    }

    const isBeforeStart = Boolean(settings.workStartDate && dateStr < settings.workStartDate);
    let shiftType: ShiftType = 'NORMAL';
    let note = '';

    if (isBeforeStart) {
      note = 'ก่อนวันเริ่มทำงาน';
    } else if (holiday) {
      shiftType = 'H';
      note = holiday.name;
    } else if (isSunday) {
      shiftType = 'H';
      note = 'วันหยุดประจำสัปดาห์';
    } else if (isSaturday && isSatOff) {
      shiftType = 'H';
      note = `หยุดวันเสาร์ (กะ ${settings.shiftGroup})`;
    }

    return {
      id: `rec-${dateStr}-${settings.shiftGroup}`,
      date: dateStr,
      dayOfWeek: dow.en,
      dayNumber,
      shiftType,
      shiftPeriod,
      isSaturdayOff: isSatOff,
      isBeforeWorkStart: isBeforeStart,
      holidayName: holiday ? holiday.name : undefined,
      ot1_0: 0,
      ot1_5: 0,
      ot2_0: 0,
      ot3_0: 0,
      note,
      startTime: '',
      endTime: '',
    };
  });
}

/**
 * Format a YYYY-MM string to Thai display: e.g. "2026-10" -> "ต.ค. 2026 (2569)"
 */
export function formatYearMonthThai(ymStr: string): string {
  if (!ymStr) return '-';
  const parts = ymStr.split('-');
  if (parts.length < 2) return ymStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const mName = thaiMonths[month - 1] || `${month}`;
  const thaiYear = year + 543;
  return `${mName} ${year} (${thaiYear})`;
}

/**
 * Determine the effective base salary for a specific cycle year and month
 * based on user's salary increments history.
 */
export function getEffectiveSalaryForCycle(
  cycleYear: number,
  cycleMonthIndex: number, // 0-11
  increments: SalaryIncrementRecord[],
  defaultSalary: number
): number {
  if (!increments || increments.length === 0) return defaultSalary;

  const cycleMonthStr = `${cycleYear}-${String(cycleMonthIndex + 1).padStart(2, '0')}`;

  // Sort ascending by effectiveMonth
  const sorted = [...increments].sort((a, b) => {
    const aM = a.effectiveMonth || `${a.effectiveYear || (2022 + a.tenureYear)}-10`;
    const bM = b.effectiveMonth || `${b.effectiveYear || (2022 + b.tenureYear)}-10`;
    return aM.localeCompare(bM);
  });

  // Find the latest increment record whose effectiveMonth <= cycleMonthStr
  let matched = defaultSalary;
  let found = false;

  for (const inc of sorted) {
    const incMonth = inc.effectiveMonth || `${inc.effectiveYear || (2022 + inc.tenureYear)}-10`;
    if (incMonth <= cycleMonthStr) {
      matched = inc.salaryAfter;
      found = true;
    } else {
      break;
    }
  }

  // If cycle is earlier than even the first record, use the earliest record's salaryBefore
  if (!found && sorted.length > 0) {
    matched = sorted[0].salaryBefore;
  }

  return matched;
}

/**
 * Retrieve vacation quota configuration for a given calendar year
 */
export function getVacationQuotaForYear(
  year: number,
  yearlyQuotas?: Record<number, { baseQuota: number; carriedOver?: number; note?: string }>,
  fallbackQuota = 8
): { baseQuota: number; carriedOver: number; totalQuota: number; note?: string } {
  if (yearlyQuotas && yearlyQuotas[year]) {
    const item = yearlyQuotas[year];
    const base = Number(item.baseQuota) || 0;
    const carry = Number(item.carriedOver) || 0;
    return {
      baseQuota: base,
      carriedOver: carry,
      totalQuota: base + carry,
      note: item.note,
    };
  }
  return {
    baseQuota: fallbackQuota,
    carriedOver: 0,
    totalQuota: fallbackQuota,
    note: 'ค่าเริ่มต้นระบบ',
  };
}
