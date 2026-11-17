export type ShiftType = 'NORMAL' | 'H' | 'E' | 'D' | 'J';
export type ShiftPeriod = 'DAY' | 'NIGHT';
export type ShiftGroup = 'A' | 'B';
export type AppView = 'timesheet' | 'calendar' | 'leave' | 'holidays' | 'dashboard';

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  isCustom?: boolean;
  type?: 'PUBLIC' | 'COMPANY' | 'SPECIAL';
  note?: string;
  sourceYear?: number;
  createdAt?: string;
}

export interface DailyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Sun, Mon, Tue, etc.
  dayNumber: number; // 1-31
  shiftType: ShiftType; // NORMAL = ปกติ, H = วันหยุด, E = ลาป่วย, D = ลากิจ, J = ลาพักร้อน
  shiftPeriod?: ShiftPeriod; // 'DAY' (กะเช้า) หรือ 'NIGHT' (กะดึก)
  isSaturdayOff?: boolean; // เป็นวันเสาร์สลับหยุดตามกะ A/B
  isBeforeWorkStart?: boolean; // อยู่ก่อนวันเริ่มทำงานที่กำหนด (ยังไม่เริ่มงาน)
  holidayName?: string; // ชื่อวันหยุดถ้าตรงกับวันหยุด
  ot1_0: number; // hours for OT 1.0x
  ot1_5: number; // hours for OT 1.5x
  ot2_0: number; // hours for OT 2.0x
  ot3_0: number; // hours for OT 3.0x
  note?: string;
  startTime?: string;
  endTime?: string;
  mealAllowance?: number;
  shiftAllowanceDay?: number;
}

export interface DiligenceRule {
  maxLeaveDays: number;
  allowance: number;
}

export interface ShiftAllowanceRule {
  maxLeaveDays: number;
  allowance: number;
}

export interface CustomTaxStimulusItem {
  id: string;
  name: string;
  amount: number;
  maxLimit?: number;
  enabled: boolean;
}

export interface TaxDeductionConfig {
  otherIncomeBonus: number; // โบนัส / รายได้พิเศษอื่นทั้งปี
  personalDeduction?: number; // ค่าลดหย่อนส่วนตัว 60,000 บาท
  hasSpouse: boolean; // คู่สมรสไม่มีรายได้ (0 หรือ 60,000)
  childCountBefore2018: number; // บุตรคนแรก / เกิดก่อนปี 2561 (คนละ 30,000)
  childCountFrom2018: number; // บุตรคนที่ 2+ เกิดตั้งแต่ปี 2561 (คนละ 60,000)
  parentsCareCount: number; // อุปการะบิดามารดา 0-4 คน (คนละ 30,000)
  disabledCareCount: number; // อุปการะผู้พิการหรือผู้ทุพพลภาพ (คนละ 60,000)
  prenatalAndChildbirthExpense: number; // ค่าฝากครรภ์และคลอดบุตร (ตามจริงสูงสุด 60,000)
  socialSecurityOverride?: number | null; // null = ดึงจากแอปอัตโนมัติ
  providentFundOverride?: number | null; // null = ดึงจากแอปอัตโนมัติ
  lifeInsurance: number; // ประกันชีวิตทั่วไป (สูงสุด 100,000)
  healthInsuranceSelf: number; // ประกันสุขภาพตนเอง (สูงสุด 25,000)
  healthInsuranceParents: number; // ประกันสุขภาพบิดามารดา (สูงสุด 15,000)
  pensionInsurance: number; // เบี้ยประกันชีวิตแบบบำนาญ (สูงสุด 15% ไม่เกิน 200,000 รวมตะกร้าเกษียณ 500,000)
  rmfAmount: number; // กองทุน RMF
  ssfAmount: number; // กองทุน SSF
  thaiEsgAmount: number; // กองทุน Thai ESG
  homeLoanInterest: number; // ดอกเบี้ยที่อยู่อาศัย (สูงสุด 100,000)
  easyEReceipt?: number; // Legacy Easy E-Receipt / ช้อปดีมีคืน (คงไว้เพื่อ backward compatibility)
  customStimulusItems?: CustomTaxStimulusItem[]; // โครงการกระตุ้นเศรษฐกิจแบบปรับเพิ่ม/ลบอิสระตามปีภาษี
  donation2xEducation: number; // เงินบริจาคการศึกษา/กีฬา/รพ.รัฐ (ลดหย่อน 2 เท่า)
  donationGeneral: number; // เงินบริจาคทั่วไป (ตามจริง 1 เท่า)
}

export interface PayrollSettings {
  appName?: string; // ชื่อระบบ/บริษัท (กำหนดให้แก้ไขได้)
  appIcon?: string; // รูปไอคอน (กำหนดให้แก้ไขได้)
  appSubtitle?: string; // สโลแกน/คำบรรยายย่อย
  employeeName: string;
  employeeId?: string;
  department?: string;
  workStartDate?: string; // วันเริ่มทำงาน / เริ่มบันทึกข้อมูล e.g. "2026-10-01" (กำหนดได้เอง)
  baseSalary: number; // ฐานเงินเดือน e.g. 37429
  daysPerMonth: number; // default 30
  hoursPerDay: number; // default 8
  providentFundRate: number; // 2% -> 0.02
  socialSecurityCap: number; // 875 or 750
  socialSecurityRate: number; // 0.05
  housingAllowance: number; // ค่าบ้าน e.g. 2000
  hardshipAllowance: number; // ค่ากันดาร e.g. 240
  foodAllowance?: number; // ตัดค่าอาหารออก
  foodDeduction?: number; // ตัดหักค่าอาหารออก
  diligenceAmount: number; // เบี้ยขยัน (เปลี่ยนจาก อื่นๆ เป็น เบี้ยขยัน)
  shiftAmount: number; // ค่าเข้ากะ (หากไม่เข้ากะจะบังคับเป็น "-")
  otherDeductions: number; // หักอื่นๆ
  taxRateEstimate: number; // ภาษีหัก ณ ที่จ่าย %
  taxPaid?: number; // ค่าภาษีที่จ่ายไป (บาท) นำมาคำนวณเงินได้สุทธิ
  
  // Cutoff configuration
  cycleStartDay: number; // 20
  cycleEndDay: number; // 19

  // Shift work configuration
  shiftWorkEnabled: boolean; // เข้ากะ (true) หรือ ไม่เข้ากะ (false)
  shiftGroup: ShiftGroup; // กะ A หรือ กะ B (มีให้เลือกเสมอทั้งเข้ากะและไม่เข้ากะ)
  shiftReferenceDate: string; // วันที่อ้างอิงสลับกะ เช่น "2026-10-01"
  shiftReferencePeriod: ShiftPeriod; // เริ่มต้นที่ DAY หรือ NIGHT

  // Leave Year Cycle Configuration
  leaveYearStartMonth: number; // เดือนเริ่มรอบปีลา (1 = ม.ค., 10 = ต.ค., 12 = ธ.ค.)
  leaveYearStartDay: number; // วันที่เริ่มรอบปีลา (เช่น 1 หรือ 20)
  leaveSickQuota: number; // โควต้าลาป่วย (วัน)
  leavePersonalQuota: number; // โควต้าลากิจ (วัน)
  leaveVacationQuota: number; // โควต้าลาพักร้อนพื้นฐาน (วัน)
  yearlyVacationQuotas?: Record<number, { baseQuota: number; carriedOver?: number; note?: string }>; // สิทธิ์วันลาพักร้อนประจำรอบปี แบบปีต่อปี
  yearlyTaxDeductions?: Record<number, TaxDeductionConfig>; // แผนลดหย่อนภาษีประจำปี ค.ศ.

  // Attendance-based allowances
  diligenceRules: DiligenceRule[];
  shiftAllowanceRules: ShiftAllowanceRule[];
}

export interface VacationYearQuota {
  year: number; // ปี ค.ศ. เช่น 2026
  baseQuota: number; // สิทธิ์พักร้อนใหม่ประจำปี เช่น 8 วัน
  carriedOver: number; // วันลาพักร้อนสะสมยกยอดมาจากปีก่อนหน้า เช่น 0 หรือ 2 วัน
  totalQuota: number; // รวมสิทธิ์ที่ใช้ได้ = baseQuota + carriedOver
  note?: string; // หมายเหตุ เช่น "อายุงานครบ 4 ปี"
}

export interface PayrollSummary {
  dailyRate: number;
  hourlyRate: number;
  ot1_0_rate: number;
  ot1_5_rate: number;
  ot2_0_rate: number;
  ot3_0_rate: number;

  totalOt1_0_hours: number;
  totalOt1_5_hours: number;
  totalOt2_0_hours: number;
  totalOt3_0_hours: number;
  totalOtHours: number;

  ot1_0_amount: number;
  ot1_5_amount: number;
  ot2_0_amount: number;
  ot3_0_amount: number;
  totalOtAmount: number;

  sickLeaveCount: number; // จำนวนวันลาป่วย (E)
  personalLeaveCount: number; // จำนวนวันลากิจ (D)
  vacationLeaveCount: number; // จำนวนวันลาพักร้อน (J)
  qualifyingLeaveDaysCount: number; // จำนวนวันลาที่มีผลหักสวัสดิการ (ไม่รวมลาพักร้อน J)
  leaveDaysCount: number; // รวมวันลาทั้งหมด (E + D + J)
  holidayCount: number; // count of 'H'
  workDaysCount: number; // count of 'NORMAL'
  
  dayShiftCount: number;
  nightShiftCount: number;

  baseDiligenceAmount: number; // เบี้ยขยันตั้งต้น (ก่อนหัก)
  diligenceDeduction: number; // หักเบี้ยขยัน (0%, 1/2, 100% ตามวันลาที่ไม่รวมพักร้อน)
  diligenceAmount: number; // เบี้ยขยัน (ในเงินได้ก่อนหัก)
  adjustedDiligenceAmount: number; // เบี้ยขยันสุทธิหลังหัก

  baseShiftAmount: number; // ค่าเข้ากะตั้งต้น (ก่อนหัก)
  shiftAllowanceDeduction: number; // หักค่าเข้ากะ (0%, 1/3, 2/3, 100% ตามวันลาที่ไม่รวมพักร้อน)
  shiftAmount: number; // ค่าเข้ากะ (ในเงินได้ก่อนหัก)
  adjustedShiftAmount: number; // ค่าเข้ากะสุทธิหลังหัก

  totalFixedAllowances: number; // รวมสวัสดิการคงที่ (บ้าน, กันดาร, รายวัน)
  totalWelfareAmount: number; // รวมสวัสดิการสุทธิทั้งหมด (รวมค่ากะและเบี้ยขยันหลังหักแล้ว)
  totalGrossIncome: number; // รวมเงินได้ก่อนหักภาษี

  providentFundAmount: number; // หักกองทุน 2%
  socialSecurityAmount: number; // ปกส.
  taxAmount: number; // ภาษี
  taxPaid: number; // ค่าภาษีที่จ่ายไป (บาท)
  foodDeductionAmount: number; // หักค่าอาหาร
  otherDeductionsAmount: number; // หักอื่นๆ
  deductionsBeforeTax: number; // รวมรายการหักก่อนภาษี
  incomeBeforeTax: number; // เงินได้ก่อนหักภาษี
  totalDeductions: number; // รวมรายการหัก
  netIncome: number; // เงินได้สุทธิ (เงินได้ก่อนหักภาษี - ภาษีที่จ่ายไป)
}

export interface SalaryIncrementRecord {
  id: string;
  tenureYear: number; // ปีที่ทำงาน เช่น 0, 1, 2, 3, 4
  effectiveMonth: string; // เดือนปีที่มีผลปรับ เช่น "2026-10" (YYYY-MM)
  salaryBefore: number; // เงินเดือนก่อนปรับ เช่น 33000
  increasePercent: number; // เปอร์เซนต์ปรับ เช่น 3.50 (%)
  salaryAfter: number; // เงินเดือนหลังปรับ เช่น 34155
  increaseAmount: number; // เงินเดือนที่เพิ่ม เช่น 1155
  providentFundDeduction: number; // กองทุนที่หัก เช่น 683 (2%)
  note?: string; // หมายเหตุ เช่น "เริ่มต้นเข้าทำงาน", "ปรับประจำปี"
  effectiveYear?: number; // ปี ค.ศ. หรือ พ.ศ.
}

export interface PaySlipAttachment {
  id: string;
  userId?: string;
  cycleKey: string; // e.g. '2026-11'
  payPeriodLabel: string; // e.g. 'รอบเดือน พฤศจิกายน 2026'
  imageDataUrl: string; // Compressed JPEG data URL
  baseSalary?: number; // รายได้ / เงินเดือน (ACT_BASE_SALARY)
  netIncome?: number; // รายรับสุทธิ (ACT_INCOME)
  incomeTax?: number; // หักภาษีเงินได้ (INCOME_TAX)
  socialSecurity?: number; // หักประกันสังคม (INSU_DEDU)
  createdAt: string;
  updatedAt?: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  downloadCount?: number;
  lastDownloadedAt?: string;
}
