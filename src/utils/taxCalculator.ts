import {
  CustomTaxStimulusItem,
  DailyRecord,
  PayrollSettings,
  SalaryIncrementRecord,
  TaxDeductionConfig,
} from '../types/overtime';
import {
  calculatePayroll,
  createCycleRecords,
  getCycleForDate,
  getEffectiveSalaryForCycle,
  round2,
} from './calculator';

export const FULL_THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export const SHORT_THAI_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export const DEFAULT_TAX_DEDUCTION_CONFIG: TaxDeductionConfig = {
  otherIncomeBonus: 0,
  personalDeduction: 60000,
  hasSpouse: false,
  childCountBefore2018: 0,
  childCountFrom2018: 0,
  parentsCareCount: 0,
  disabledCareCount: 0,
  prenatalAndChildbirthExpense: 0,
  socialSecurityOverride: null,
  providentFundOverride: null,
  lifeInsurance: 0,
  healthInsuranceSelf: 0,
  healthInsuranceParents: 0,
  pensionInsurance: 0,
  rmfAmount: 0,
  ssfAmount: 0,
  thaiEsgAmount: 0,
  homeLoanInterest: 0,
  easyEReceipt: 0,
  customStimulusItems: [],
  donation2xEducation: 0,
  donationGeneral: 0,
};

export function sanitizeCustomStimulusItems(
  items?: CustomTaxStimulusItem[] | null
): CustomTaxStimulusItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => {
    const rawAmount = Number(item?.amount);
    const rawLimit = Number(item?.maxLimit);
    const cleaned: CustomTaxStimulusItem = {
      id: typeof item?.id === 'string' && item.id.trim() !== '' ? item.id.trim() : `stim-${idx + 1}`,
      name: typeof item?.name === 'string' ? item.name : '',
      amount: Number.isFinite(rawAmount) && rawAmount > 0 ? round2(rawAmount) : 0,
      enabled: item?.enabled !== false,
    };
    if (Number.isFinite(rawLimit) && rawLimit > 0) {
      cleaned.maxLimit = round2(rawLimit);
    }
    return cleaned;
  });
}

export function normalizeTaxDeductionConfig(
  raw?: Partial<TaxDeductionConfig> | null
): TaxDeductionConfig {
  const src = raw || {};
  const toNonNeg = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? round2(n) : 0;
  };
  const toNonNegInt = (v: unknown, max = 20) => {
    const n = Math.floor(Number(v) || 0);
    return Math.min(max, Math.max(0, n));
  };

  const legacyEasyEReceipt = toNonNeg(src.easyEReceipt);
  const cleanedItems = sanitizeCustomStimulusItems(src.customStimulusItems);
  const hasLegacyItemAlready = cleanedItems.some((item) => item.id === 'legacy-easy-ereceipt');

  if (legacyEasyEReceipt > 0 && !hasLegacyItemAlready) {
    cleanedItems.unshift({
      id: 'legacy-easy-ereceipt',
      name: 'Easy E-Receipt / ช้อปดีมีคืน',
      amount: legacyEasyEReceipt,
      maxLimit: 50000,
      enabled: true,
    });
  }

  return {
    otherIncomeBonus: toNonNeg(src.otherIncomeBonus),
    personalDeduction: 60000,
    hasSpouse: Boolean(src.hasSpouse),
    childCountBefore2018: toNonNegInt(src.childCountBefore2018, 20),
    childCountFrom2018: toNonNegInt(src.childCountFrom2018, 20),
    parentsCareCount: toNonNegInt(src.parentsCareCount, 4),
    disabledCareCount: toNonNegInt(src.disabledCareCount, 20),
    prenatalAndChildbirthExpense: toNonNeg(src.prenatalAndChildbirthExpense),
    socialSecurityOverride:
      src.socialSecurityOverride !== undefined && src.socialSecurityOverride !== null
        ? toNonNeg(src.socialSecurityOverride)
        : null,
    providentFundOverride:
      src.providentFundOverride !== undefined && src.providentFundOverride !== null
        ? toNonNeg(src.providentFundOverride)
        : null,
    lifeInsurance: toNonNeg(src.lifeInsurance),
    healthInsuranceSelf: toNonNeg(src.healthInsuranceSelf),
    healthInsuranceParents: toNonNeg(src.healthInsuranceParents),
    pensionInsurance: toNonNeg(src.pensionInsurance),
    rmfAmount: toNonNeg(src.rmfAmount),
    ssfAmount: toNonNeg(src.ssfAmount),
    thaiEsgAmount: toNonNeg(src.thaiEsgAmount),
    homeLoanInterest: toNonNeg(src.homeLoanInterest),
    easyEReceipt: 0,
    customStimulusItems: cleanedItems,
    donation2xEducation: toNonNeg(src.donation2xEducation),
    donationGeneral: toNonNeg(src.donationGeneral),
  };
}

export interface TaxMonthlyCycleRow {
  cycleKey: string;
  year: number;
  monthIndex: number; // 0-11
  monthName: string;
  shortMonthName: string;
  cyclePeriodLabel: string;
  baseSalary: number;
  otAmount: number;
  allowancesAmount: number; // adjusted diligence + adjusted shift + fixed allowances
  grossIncome: number; // base + OT + adjusted shift + adjusted diligence + fixed allowances
  socialSecurity: number;
  providentFund: number;
  taxPaid: number;
  isRecorded: boolean;
  isBeforeWorkStart: boolean;
}

export interface TaxBracketBreakdownRow {
  id: string;
  label: string;
  minIncome: number;
  maxIncome: number | null; // null = no upper bound
  ratePercent: number;
  taxableInBracket: number;
  taxInBracket: number;
  isActive: boolean;
}

export interface CustomStimulusBreakdownRow {
  id: string;
  name: string;
  inputAmount: number;
  effectiveAmount: number;
  maxLimit?: number;
  enabled: boolean;
  isCapped: boolean;
}

export interface AnnualTaxCalculationResult {
  year: number;
  monthlyRows: TaxMonthlyCycleRow[];
  cycleGrossIncomeTotal: number;
  otherIncomeBonus: number;
  totalAnnualGrossIncome: number;

  // Standard 50% expense deduction (max 100,000)
  expenseDeduction: number;

  // Auto-pulled annual deductions from 12 cycles
  autoSocialSecurity: number;
  autoProvidentFund: number;

  // Effective capped deductions
  personalDeduction: number;
  spouseDeduction: number;
  childrenDeduction: number;
  parentsDeduction: number;
  disabledCareDeduction: number;
  effectivePrenatalExpense: number;
  effectiveSocialSecurity: number;
  effectiveProvidentFund: number;
  effectiveLifeInsurance: number;
  effectiveHealthSelf: number;
  effectiveLifeAndHealthCombined: number;
  lifeHealthCombinedCapped: boolean;
  effectiveHealthParents: number;
  effectivePensionInsurance: number;
  effectiveRmf: number;
  effectiveSsf: number;
  retirementBasketCapped: boolean;
  effectiveThaiEsg: number;
  effectiveHomeInterest: number;
  effectiveEasyEReceipt: number;
  customStimulusBreakdown: CustomStimulusBreakdownRow[];
  effectiveCustomStimulusTotal: number;
  donationCap: number;
  effectiveDonation2x: number;
  effectiveDonationGeneral: number;
  effectiveDonationsTotal: number;

  // Group subtotals & total deductions
  familyDeductionsTotal: number;
  insuranceAndFundsTotal: number;
  stimulusAndDonationsTotal: number;
  totalDeductions: number;

  // Taxable income & Progressive Tax
  netTaxableIncome: number;
  brackets: TaxBracketBreakdownRow[];
  totalComputedTax: number;
  marginalRatePercent: number;
  effectiveTaxRatePercent: number;

  // Withholding & Year-End Settlement
  totalWithholdingTaxPaid: number;
  settlementDiff: number; // totalWithholdingTaxPaid - totalComputedTax (>0 refund, <0 payable)
  settlementStatus: 'REFUND' | 'PAYABLE' | 'EVEN';
  settlementAmountAbs: number;
}

const THAI_TAX_BRACKETS: Array<{
  id: string;
  label: string;
  minIncome: number;
  maxIncome: number | null;
  ratePercent: number;
}> = [
  { id: 'b0', label: '0 - 150,000 บาท', minIncome: 0, maxIncome: 150000, ratePercent: 0 },
  { id: 'b5', label: '150,001 - 300,000 บาท', minIncome: 150000, maxIncome: 300000, ratePercent: 5 },
  { id: 'b10', label: '300,001 - 500,000 บาท', minIncome: 300000, maxIncome: 500000, ratePercent: 10 },
  { id: 'b15', label: '500,001 - 750,000 บาท', minIncome: 500000, maxIncome: 750000, ratePercent: 15 },
  { id: 'b20', label: '750,001 - 1,000,000 บาท', minIncome: 750000, maxIncome: 1000000, ratePercent: 20 },
  { id: 'b25', label: '1,000,001 - 2,000,000 บาท', minIncome: 1000000, maxIncome: 2000000, ratePercent: 25 },
  { id: 'b30', label: '2,000,001 - 5,000,000 บาท', minIncome: 2000000, maxIncome: 5000000, ratePercent: 30 },
  { id: 'b35', label: '5,000,001 บาทขึ้นไป', minIncome: 5000000, maxIncome: null, ratePercent: 35 },
];

export function calculateProgressiveThaiTax(netTaxableIncome: number): {
  totalTax: number;
  marginalRatePercent: number;
  brackets: TaxBracketBreakdownRow[];
} {
  const safeTaxable = Math.max(0, round2(netTaxableIncome));
  let totalTax = 0;
  let marginalRatePercent = 0;

  const brackets: TaxBracketBreakdownRow[] = THAI_TAX_BRACKETS.map((b) => {
    const upper = b.maxIncome ?? Infinity;
    const taxableInBracket =
      safeTaxable > b.minIncome
        ? round2(Math.min(safeTaxable, upper) - b.minIncome)
        : 0;
    const taxInBracket = round2(taxableInBracket * (b.ratePercent / 100));
    if (taxableInBracket > 0) {
      marginalRatePercent = b.ratePercent;
    }
    totalTax = round2(totalTax + taxInBracket);

    return {
      ...b,
      taxableInBracket,
      taxInBracket,
      isActive: taxableInBracket > 0 || (safeTaxable === 0 && b.ratePercent === 0),
    };
  });

  return {
    totalTax,
    marginalRatePercent,
    brackets,
  };
}

export function extractYearMonthlyTaxRows(
  year: number,
  allCycleRecords: Record<string, DailyRecord[]>,
  cycleTaxes: Record<string, number>,
  settings: PayrollSettings,
  salaryIncrements: SalaryIncrementRecord[] = []
): TaxMonthlyCycleRow[] {
  const hasWorkStartDate = Boolean(settings.workStartDate && settings.workStartDate.trim() !== '');
  const startCycle = hasWorkStartDate
    ? getCycleForDate(settings.workStartDate!, settings.cycleStartDay, settings.cycleEndDay)
    : null;

  const rows: TaxMonthlyCycleRow[] = [];

  for (let m = 0; m < 12; m++) {
    const cycleKey = `${year}-${String(m + 1).padStart(2, '0')}`;
    const hasCustomRecords = Boolean(allCycleRecords[cycleKey] && allCycleRecords[cycleKey].length > 0);
    const isBeforeWorkStart =
      Boolean(startCycle) &&
      !hasCustomRecords &&
      (year < startCycle!.year || (year === startCycle!.year && m < startCycle!.month));

    const prevMonthIndex = m === 0 ? 11 : m - 1;
    const prevMonthYear = m === 0 ? year - 1 : year;
    const cyclePeriodLabel = `${settings.cycleStartDay} ${SHORT_THAI_MONTHS[prevMonthIndex]} ${prevMonthYear} - ${settings.cycleEndDay} ${SHORT_THAI_MONTHS[m]} ${year}`;
    const cycleTax = round2(Math.max(0, Number(cycleTaxes[cycleKey]) || 0));

    if (isBeforeWorkStart) {
      rows.push({
        cycleKey,
        year,
        monthIndex: m,
        monthName: FULL_THAI_MONTHS[m],
        shortMonthName: SHORT_THAI_MONTHS[m],
        cyclePeriodLabel,
        baseSalary: 0,
        otAmount: 0,
        allowancesAmount: 0,
        grossIncome: 0,
        socialSecurity: 0,
        providentFund: 0,
        taxPaid: cycleTax,
        isRecorded: false,
        isBeforeWorkStart: true,
      });
      continue;
    }

    const records = hasCustomRecords
      ? allCycleRecords[cycleKey]
      : createCycleRecords(year, m, settings);

    const effectiveSalary = getEffectiveSalaryForCycle(
      year,
      m,
      salaryIncrements,
      settings.baseSalary
    );

    const summary = calculatePayroll(records, {
      ...settings,
      baseSalary: effectiveSalary,
      taxPaid: cycleTax,
    });

    const allowancesAmount = round2(
      summary.adjustedDiligenceAmount + summary.adjustedShiftAmount + summary.totalFixedAllowances
    );
    const grossIncome = round2(effectiveSalary + summary.totalOtAmount + allowancesAmount);

    rows.push({
      cycleKey,
      year,
      monthIndex: m,
      monthName: FULL_THAI_MONTHS[m],
      shortMonthName: SHORT_THAI_MONTHS[m],
      cyclePeriodLabel,
      baseSalary: effectiveSalary,
      otAmount: summary.totalOtAmount,
      allowancesAmount,
      grossIncome,
      socialSecurity: summary.socialSecurityAmount,
      providentFund: summary.providentFundAmount,
      taxPaid: cycleTax,
      isRecorded: hasCustomRecords,
      isBeforeWorkStart: false,
    });
  }

  return rows;
}

export function calculateAnnualTaxPlan(params: {
  year: number;
  allCycleRecords: Record<string, DailyRecord[]>;
  cycleTaxes: Record<string, number>;
  settings: PayrollSettings;
  salaryIncrements?: SalaryIncrementRecord[];
  configOverride?: Partial<TaxDeductionConfig> | null;
}): AnnualTaxCalculationResult {
  const {
    year,
    allCycleRecords,
    cycleTaxes,
    settings,
    salaryIncrements = [],
    configOverride,
  } = params;

  const savedConfig = settings.yearlyTaxDeductions?.[year];
  const cfg = normalizeTaxDeductionConfig(configOverride ?? savedConfig);

  const monthlyRows = extractYearMonthlyTaxRows(
    year,
    allCycleRecords,
    cycleTaxes,
    settings,
    salaryIncrements
  );

  const cycleGrossIncomeTotal = round2(
    monthlyRows.reduce((sum, r) => sum + r.grossIncome, 0)
  );
  const otherIncomeBonus = cfg.otherIncomeBonus;
  const totalAnnualGrossIncome = round2(cycleGrossIncomeTotal + otherIncomeBonus);

  // Standard 50% expense deduction capped at 100,000 THB
  const expenseDeduction = round2(Math.min(totalAnnualGrossIncome * 0.5, 100000));

  // Auto-sum SSO & PVD from 12 cycles
  const rawAutoSso = round2(monthlyRows.reduce((sum, r) => sum + r.socialSecurity, 0));
  const autoSocialSecurity = round2(Math.min(rawAutoSso, 9000));
  const autoProvidentFund = round2(monthlyRows.reduce((sum, r) => sum + r.providentFund, 0));

  // Group 1: Personal & Family
  const personalDeduction = 60000;
  const spouseDeduction = cfg.hasSpouse ? 60000 : 0;
  const childrenDeduction = round2(
    cfg.childCountBefore2018 * 30000 + cfg.childCountFrom2018 * 60000
  );
  const parentsDeduction = round2(Math.min(4, cfg.parentsCareCount) * 30000);
  const disabledCareDeduction = round2(Math.max(0, cfg.disabledCareCount) * 60000);
  const effectivePrenatalExpense = round2(Math.min(cfg.prenatalAndChildbirthExpense, 60000));
  const familyDeductionsTotal = round2(
    personalDeduction +
      spouseDeduction +
      childrenDeduction +
      parentsDeduction +
      disabledCareDeduction +
      effectivePrenatalExpense
  );

  // Group 2: Insurance & Funds
  const rawSsoInput =
    cfg.socialSecurityOverride !== null && cfg.socialSecurityOverride !== undefined
      ? cfg.socialSecurityOverride
      : autoSocialSecurity;
  const effectiveSocialSecurity = round2(Math.min(Math.max(0, rawSsoInput), 9000));

  const rawPvdInput =
    cfg.providentFundOverride !== null && cfg.providentFundOverride !== undefined
      ? cfg.providentFundOverride
      : autoProvidentFund;

  const effectiveLifeInsurance = round2(Math.min(cfg.lifeInsurance, 100000));
  const effectiveHealthSelf = round2(Math.min(cfg.healthInsuranceSelf, 25000));
  const lifeHealthCombinedRaw = round2(effectiveLifeInsurance + effectiveHealthSelf);
  const effectiveLifeAndHealthCombined = round2(Math.min(lifeHealthCombinedRaw, 100000));
  const lifeHealthCombinedCapped = lifeHealthCombinedRaw > 100000;

  const effectiveHealthParents = round2(Math.min(cfg.healthInsuranceParents, 15000));

  const fifteenPercentIncome = round2(totalAnnualGrossIncome * 0.15);
  const thirtyPercentIncome = round2(totalAnnualGrossIncome * 0.3);
  const pensionCappedIndividual = round2(
    Math.min(cfg.pensionInsurance, fifteenPercentIncome, 200000)
  );
  const rmfCappedIndividual = round2(Math.min(cfg.rmfAmount, thirtyPercentIncome, 500000));
  const ssfCappedIndividual = round2(Math.min(cfg.ssfAmount, thirtyPercentIncome, 200000));
  const pvdCappedIndividual = round2(Math.min(Math.max(0, rawPvdInput), 500000));

  // Retirement basket cap: PVD + Pension Insurance + RMF + SSF <= 500,000 THB
  const retirementRawSum = round2(
    pvdCappedIndividual + pensionCappedIndividual + rmfCappedIndividual + ssfCappedIndividual
  );
  const retirementBasketCapped = retirementRawSum > 500000;
  let effectiveProvidentFund = pvdCappedIndividual;
  let effectivePensionInsurance = pensionCappedIndividual;
  let effectiveRmf = rmfCappedIndividual;
  let effectiveSsf = ssfCappedIndividual;
  if (retirementBasketCapped) {
    let remainingBasket = 500000;
    effectiveProvidentFund = Math.min(pvdCappedIndividual, remainingBasket);
    remainingBasket = round2(remainingBasket - effectiveProvidentFund);
    effectivePensionInsurance = Math.min(pensionCappedIndividual, remainingBasket);
    remainingBasket = round2(remainingBasket - effectivePensionInsurance);
    effectiveRmf = Math.min(rmfCappedIndividual, remainingBasket);
    remainingBasket = round2(remainingBasket - effectiveRmf);
    effectiveSsf = Math.min(ssfCappedIndividual, remainingBasket);
  }

  // Thai ESG has independent cap (max 30% of assessable income and <= 300,000 THB)
  const effectiveThaiEsg = round2(Math.min(cfg.thaiEsgAmount, thirtyPercentIncome, 300000));

  const insuranceAndFundsTotal = round2(
    effectiveSocialSecurity +
      effectiveProvidentFund +
      effectiveLifeAndHealthCombined +
      effectiveHealthParents +
      effectivePensionInsurance +
      effectiveRmf +
      effectiveSsf +
      effectiveThaiEsg
  );

  // Group 3: Stimulus (Home Interest + Dynamic Custom Stimulus Projects)
  const effectiveHomeInterest = round2(Math.min(cfg.homeLoanInterest, 100000));

  const customStimulusBreakdown: CustomStimulusBreakdownRow[] = (
    cfg.customStimulusItems || []
  ).map((item) => {
    const inputAmount = Math.max(0, round2(Number(item.amount) || 0));
    const hasLimit = item.maxLimit !== undefined && item.maxLimit !== null && Number(item.maxLimit) > 0;
    const limitVal = hasLimit ? round2(Number(item.maxLimit)) : undefined;
    const enabled = item.enabled !== false;
    const effectiveAmount = !enabled
      ? 0
      : limitVal !== undefined
      ? round2(Math.min(inputAmount, limitVal))
      : inputAmount;
    const isCapped = Boolean(enabled && limitVal !== undefined && inputAmount > limitVal);
    return {
      id: item.id,
      name: item.name,
      inputAmount,
      effectiveAmount,
      ...(limitVal !== undefined ? { maxLimit: limitVal } : {}),
      enabled,
      isCapped,
    };
  });

  const effectiveCustomStimulusTotal = round2(
    customStimulusBreakdown.reduce((sum, item) => sum + item.effectiveAmount, 0)
  );
  const effectiveEasyEReceipt = effectiveCustomStimulusTotal;

  // Donations: max 10% of income after expenses & all other deductions
  const deductionsBeforeDonation = round2(
    familyDeductionsTotal +
      insuranceAndFundsTotal +
      effectiveHomeInterest +
      effectiveCustomStimulusTotal
  );
  const incomeAfterOtherDeductions = Math.max(
    0,
    round2(totalAnnualGrossIncome - expenseDeduction - deductionsBeforeDonation)
  );
  const donationCap = round2(incomeAfterOtherDeductions * 0.1);
  const effectiveDonation2x = round2(Math.min(cfg.donation2xEducation * 2, donationCap));
  const remainingDonationCap = Math.max(0, round2(donationCap - effectiveDonation2x));
  const effectiveDonationGeneral = round2(Math.min(cfg.donationGeneral, remainingDonationCap));
  const effectiveDonationsTotal = round2(effectiveDonation2x + effectiveDonationGeneral);

  const stimulusAndDonationsTotal = round2(
    effectiveHomeInterest + effectiveCustomStimulusTotal + effectiveDonationsTotal
  );

  const totalDeductions = round2(
    familyDeductionsTotal + insuranceAndFundsTotal + stimulusAndDonationsTotal
  );

  const netTaxableIncome = Math.max(
    0,
    round2(totalAnnualGrossIncome - expenseDeduction - totalDeductions)
  );

  const {
    totalTax: totalComputedTax,
    marginalRatePercent,
    brackets,
  } = calculateProgressiveThaiTax(netTaxableIncome);

  const effectiveTaxRatePercent =
    totalAnnualGrossIncome > 0
      ? round2((totalComputedTax / totalAnnualGrossIncome) * 100)
      : 0;

  const totalWithholdingTaxPaid = round2(
    monthlyRows.reduce((sum, r) => sum + r.taxPaid, 0)
  );
  const settlementDiff = round2(totalWithholdingTaxPaid - totalComputedTax);

  let settlementStatus: 'REFUND' | 'PAYABLE' | 'EVEN' = 'EVEN';
  if (settlementDiff > 0.005) {
    settlementStatus = 'REFUND';
  } else if (settlementDiff < -0.005) {
    settlementStatus = 'PAYABLE';
  }

  return {
    year,
    monthlyRows,
    cycleGrossIncomeTotal,
    otherIncomeBonus,
    totalAnnualGrossIncome,
    expenseDeduction,
    autoSocialSecurity,
    autoProvidentFund,
    personalDeduction,
    spouseDeduction,
    childrenDeduction,
    parentsDeduction,
    disabledCareDeduction,
    effectivePrenatalExpense,
    effectiveSocialSecurity,
    effectiveProvidentFund,
    effectiveLifeInsurance,
    effectiveHealthSelf,
    effectiveLifeAndHealthCombined,
    lifeHealthCombinedCapped,
    effectiveHealthParents,
    effectivePensionInsurance,
    effectiveRmf,
    effectiveSsf,
    retirementBasketCapped,
    effectiveThaiEsg,
    effectiveHomeInterest,
    effectiveEasyEReceipt,
    customStimulusBreakdown,
    effectiveCustomStimulusTotal,
    donationCap,
    effectiveDonation2x,
    effectiveDonationGeneral,
    effectiveDonationsTotal,
    familyDeductionsTotal,
    insuranceAndFundsTotal,
    stimulusAndDonationsTotal,
    totalDeductions,
    netTaxableIncome,
    brackets,
    totalComputedTax,
    marginalRatePercent,
    effectiveTaxRatePercent,
    totalWithholdingTaxPaid,
    settlementDiff,
    settlementStatus,
    settlementAmountAbs: round2(Math.abs(settlementDiff)),
  };
}
