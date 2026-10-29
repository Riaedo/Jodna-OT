import { DailyRecord, PayrollSettings } from '../types/overtime';
import { createCycleRecords } from '../utils/calculator';

export const DEFAULT_SETTINGS: PayrollSettings = {
  appName: '',
  appIcon: 'Calculator',
  appSubtitle: '',
  employeeName: '',
  employeeId: '',
  department: '',
  workStartDate: '',
  baseSalary: 0,
  daysPerMonth: 30,
  hoursPerDay: 8,
  providentFundRate: 0,
  socialSecurityCap: 875,
  socialSecurityRate: 0.05,
  housingAllowance: 0,
  hardshipAllowance: 0,
  diligenceAmount: 0,
  shiftAmount: 0,
  otherDeductions: 0,
  taxRateEstimate: 0,
  taxPaid: 0,
  cycleStartDay: 20,
  cycleEndDay: 19,
  
  // Shift work configuration
  shiftWorkEnabled: true,
  shiftGroup: 'A',
  shiftReferenceDate: '',
  shiftReferencePeriod: 'DAY',

  // Yearly Leave Configuration
  leaveYearStartMonth: 1, // มกราคม
  leaveYearStartDay: 20,
  leaveSickQuota: 30,
  leavePersonalQuota: 6,
  leaveVacationQuota: 6,
  yearlyVacationQuotas: {},

  diligenceRules: [
    { maxLeaveDays: 0, allowance: 0 },
    { maxLeaveDays: 1, allowance: 0 },
    { maxLeaveDays: 2, allowance: 0 },
  ],
  shiftAllowanceRules: [
    { maxLeaveDays: 0, allowance: 0 },
    { maxLeaveDays: 1, allowance: 0 },
    { maxLeaveDays: 2, allowance: 0 },
  ],
};

export function getInitialRecords(settings: PayrollSettings = DEFAULT_SETTINGS): DailyRecord[] {
  if (!settings.workStartDate) {
    return [];
  }
  const parts = settings.workStartDate.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  return createCycleRecords(y, m, settings, []);
}
