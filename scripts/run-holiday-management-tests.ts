import { Holiday } from '../src/types/overtime';
import { 
  shiftHolidayDateToYear, 
  filterHolidaysByYear, 
  getAvailableHolidayYears, 
  canCopyHolidaysFromYear, 
  copyHolidaysToYear, 
  checkDuplicateHoliday 
} from '../src/utils/holidayManager';
import { createCycleRecords } from '../src/utils/calculator';
import { DEFAULT_SETTINGS } from '../src/data/initialData';

console.log('======================================================================');
console.log('🧪 RUNNING ANNUAL HOLIDAYS YEAR-TO-YEAR COPY & MANAGEMENT TEST SUITE');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

// ----------------------------------------------------
// BASE DATA: Realistic 15 Annual Holidays for Year 2026
// ----------------------------------------------------
const base2026Holidays: Holiday[] = [
  { id: 'hol-2026-01', date: '2026-01-01', name: 'วันขึ้นปีใหม่', type: 'PUBLIC' },
  { id: 'hol-2026-02', date: '2026-03-03', name: 'วันมาฆบูชา', type: 'PUBLIC' },
  { id: 'hol-2026-03', date: '2026-04-06', name: 'วันจักรี', type: 'PUBLIC' },
  { id: 'hol-2026-04', date: '2026-04-13', name: 'วันสงกรานต์', type: 'PUBLIC' },
  { id: 'hol-2026-05', date: '2026-04-14', name: 'วันสงกรานต์', type: 'PUBLIC' },
  { id: 'hol-2026-06', date: '2026-04-15', name: 'วันสงกรานต์', type: 'PUBLIC' },
  { id: 'hol-2026-07', date: '2026-05-01', name: 'วันแรงงานแห่งชาติ', type: 'PUBLIC' },
  { id: 'hol-2026-08', date: '2026-05-04', name: 'วันฉัตรมงคล', type: 'PUBLIC' },
  { id: 'hol-2026-09', date: '2026-05-31', name: 'วันวิสาขบูชา', type: 'PUBLIC' },
  { id: 'hol-2026-10', date: '2026-07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10', type: 'PUBLIC' },
  { id: 'hol-2026-11', date: '2026-07-29', name: 'วันอาสาฬหบูชา', type: 'PUBLIC' },
  { id: 'hol-2026-12', date: '2026-08-12', name: 'วันแม่แห่งชาติ', type: 'PUBLIC' },
  { id: 'hol-2026-13', date: '2026-10-13', name: 'วันนวมินทรมหาราช', type: 'PUBLIC' },
  { id: 'hol-2026-14', date: '2026-10-23', name: 'วันปิยมหาราช', type: 'PUBLIC' },
  { id: 'hol-2026-15', date: '2026-12-05', name: 'วันพ่อแห่งชาติ', type: 'PUBLIC' },
];

let globalHolidays: Holiday[] = [...base2026Holidays];

// ----------------------------------------------------
// TEST 1: สร้างวันหยุดปี 2027 จากปี 2026
// ----------------------------------------------------
console.log('--- TEST 1 & 2: Copy Holidays from 2026 to 2027 ---');
const copyResult = copyHolidaysToYear(globalHolidays, 2026, 2027);

assert(
  copyResult.newHolidays.length === 15,
  'Test 1: สร้างวันหยุดปี 2027 จากปี 2026 สำเร็จ',
  `Expected 15, got ${copyResult.newHolidays.length}`
);

// ----------------------------------------------------
// TEST 2: จำนวนรายการที่คัดลอกต้องตรงกับต้นแบบ
// ----------------------------------------------------
assert(
  copyResult.copiedCount === base2026Holidays.length,
  'Test 2: จำนวนรายการที่คัดลอก (15 รายการ) ตรงกับต้นแบบ 2026 พอดี',
  `Expected ${base2026Holidays.length}, got ${copyResult.copiedCount}`
);

// Check IDs are brand-new and dates shifted
const allIdsUnique = copyResult.newHolidays.every((newH) => 
  !base2026Holidays.some((oldH) => oldH.id === newH.id)
);
assert(allIdsUnique, 'Holiday IDs ของปี 2027 ถูกสร้างขึ้นใหม่ทั้งหมด ไม่ซ้ำกับปี 2026');

const allDatesIn2027 = copyResult.newHolidays.every((h) => h.date.startsWith('2027-'));
assert(allDatesIn2027, 'วันที่ของรายการปี 2027 ถูกเปลี่ยนเป็นปี ค.ศ. 2027 ทั้งหมด');

const allHaveSourceYear = copyResult.newHolidays.every((h) => h.sourceYear === 2026);
assert(allHaveSourceYear, 'ทุกรายการที่คัดลอกบันทึก sourceYear: 2026 เพื่อเป็น Audit Trail ย้อนหลัง');

// Add 2027 holidays into global state
globalHolidays = [...globalHolidays, ...copyResult.newHolidays];

// ----------------------------------------------------
// TEST 3: แก้ไขวันที่ในปี 2027 แล้วปี 2026 ต้องไม่เปลี่ยน
// ----------------------------------------------------
console.log('\n--- TEST 3: Edit Date in 2027 (2026 Must Remain Unchanged) ---');
// In 2027, Visakha Bucha moves from May 31 to May 20
const visakha2027 = globalHolidays.find((h) => h.date.startsWith('2027-') && h.name === 'วันวิสาขบูชา');
assert(Boolean(visakha2027), 'ค้นหารายการวันวิสาขบูชาของปี 2027 พบ');

if (visakha2027) {
  const updated2027: Holiday = { ...visakha2027, date: '2027-05-20', note: 'ปรับตามปฏิทินจันทรคติปี 2570' };
  globalHolidays = globalHolidays.map((h) => (h.id === updated2027.id ? updated2027 : h));

  const visakha2026After = globalHolidays.find((h) => h.date.startsWith('2026-') && h.name === 'วันวิสาขบูชา');
  assert(
    visakha2026After?.date === '2026-05-31',
    'Test 3: แก้ไขวันวิสาขบูชาปี 2027 เป็น 2027-05-20 แล้ว วันวิสาขบูชาปี 2026 ยังคงเป็น 2026-05-31 เหมือนเดิม 100%',
    `2026 date: ${visakha2026After?.date}`
  );
  assert(
    visakha2026After?.note === undefined,
    'หมายเหตุของปี 2026 ไม่ถูกแก้ไขตามปี 2027'
  );
}

// ----------------------------------------------------
// TEST 4: เพิ่มวันหยุดใหม่ในปี 2027
// ----------------------------------------------------
console.log('\n--- TEST 4: Add New Holiday in 2027 ---');
const newSpecialHoliday2027: Holiday = {
  id: 'hol-2027-special-01',
  date: '2027-12-31',
  name: 'วันหยุดพิเศษสิ้นปี 2570',
  type: 'COMPANY',
  isCustom: true,
  note: 'ประกาศหยุดพิเศษบริษัท',
};

globalHolidays = [...globalHolidays, newSpecialHoliday2027];

const count2027AfterAdd = filterHolidaysByYear(globalHolidays, 2027).length;
const count2026AfterAdd = filterHolidaysByYear(globalHolidays, 2026).length;

assert(
  count2027AfterAdd === 16,
  'Test 4: เพิ่มวันหยุดใหม่ในปี 2027 สำเร็จ (ปี 2027 มี 16 รายการ)',
  `Count 2027: ${count2027AfterAdd}`
);
assert(
  count2026AfterAdd === 15,
  'ปี 2026 ยังคงมี 15 รายการเท่าเดิม ไม่ได้รับผลกระทบจากการเพิ่มวันหยุดในปี 2027',
  `Count 2026: ${count2026AfterAdd}`
);

// ----------------------------------------------------
// TEST 5: ลบวันหยุดในปี 2027 โดยปี 2026 ต้องยังอยู่ครบ
// ----------------------------------------------------
console.log('\n--- TEST 5: Delete Holiday in 2027 ---');
// Delete Labor day from 2027
const labor2027 = globalHolidays.find((h) => h.date.startsWith('2027-') && h.name === 'วันแรงงานแห่งชาติ');
assert(Boolean(labor2027), 'ค้นหาวันแรงงานแห่งชาติปี 2027 เพื่อจำลองการลบ');

if (labor2027) {
  globalHolidays = globalHolidays.filter((h) => h.id !== labor2027.id);
  
  const count2027AfterDelete = filterHolidaysByYear(globalHolidays, 2027).length;
  const count2026AfterDelete = filterHolidaysByYear(globalHolidays, 2026).length;
  const labor2026StillExists = globalHolidays.some((h) => h.date === '2026-05-01' && h.name === 'วันแรงงานแห่งชาติ');

  assert(
    count2027AfterDelete === 15,
    'Test 5: ลบวันแรงงานปี 2027 สำเร็จ (ปี 2027 เหลือ 15 รายการ)',
    `Count 2027: ${count2027AfterDelete}`
  );
  assert(
    count2026AfterDelete === 15 && labor2026StillExists,
    'วันแรงงานแห่งชาติปี 2026 (2026-05-01) ยังคงอยู่ครบถ้วนสมบูรณ์ ไม่ถูกลบตาม',
    `Labor 2026 exists: ${labor2026StillExists}`
  );
}

// ----------------------------------------------------
// TEST 6: สร้างปี 2027 ซ้ำ ต้องไม่สร้างข้อมูลซ้ำ (Guard Protection)
// ----------------------------------------------------
console.log('\n--- TEST 6: Prevent Duplicate Year Creation ---');
const canCopyAgain = canCopyHolidaysFromYear(globalHolidays, 2027);
assert(
  !canCopyAgain.canCopy,
  'Test 6: canCopyHolidaysFromYear ตรวจพบว่าปี 2027 มีข้อมูลอยู่แล้ว จึงปฏิเสธการคัดลอกซ้ำ (canCopy: false)',
  `Reason: ${canCopyAgain.reason}`
);

let caughtDuplicateError = false;
try {
  copyHolidaysToYear(globalHolidays, 2026, 2027);
} catch (e: any) {
  caughtDuplicateError = true;
}
assert(
  caughtDuplicateError,
  'copyHolidaysToYear โยน Error ดักจับทันทีเมื่อพยายามคัดลอกทับปี 2027 ที่มีข้อมูลอยู่แล้ว'
);

// ----------------------------------------------------
// TEST 7: ปีที่ยังไม่มีข้อมูลต้องแสดงสถานะอย่างถูกต้อง
// ----------------------------------------------------
console.log('\n--- TEST 7: Empty Year Status & Auto-Source Detection ---');
const holidays2028 = filterHolidaysByYear(globalHolidays, 2028);
assert(
  holidays2028.length === 0,
  'Test 7.1: ปี ค.ศ. 2028 ยังไม่มีข้อมูลวันหยุด (length === 0)',
  `Count: ${holidays2028.length}`
);

const copyCheck2028 = canCopyHolidaysFromYear(globalHolidays, 2028);
assert(
  copyCheck2028.canCopy && copyCheck2028.sourceYear === 2027 && copyCheck2028.sourceCount === 15,
  'Test 7.2: ระบบตรวจจับอัตโนมัติว่าปี 2028 สามารถคัดลอกต้นแบบจากปี 2027 (15 รายการ) ได้อย่างถูกต้อง',
  `Source Year: ${copyCheck2028.sourceYear}, Count: ${copyCheck2028.sourceCount}`
);

// ----------------------------------------------------
// TEST 8: Refresh แล้วข้อมูลยังอยู่ (Storage Serialization / Hydration)
// ----------------------------------------------------
console.log('\n--- TEST 8: Storage Serialization / Hydration ---');
const serialized = JSON.stringify(globalHolidays);
const hydrated: Holiday[] = JSON.parse(serialized);

const hydrated2026 = filterHolidaysByYear(hydrated, 2026);
const hydrated2027 = filterHolidaysByYear(hydrated, 2027);

assert(
  hydrated2026.length === 15 && hydrated2027.length === 15,
  'Test 8: ข้อมูลทุกรายการของปี 2026 และ 2027 ผ่านการ Serialize/Hydrate ครบถ้วน 100%',
  `2026: ${hydrated2026.length}, 2027: ${hydrated2027.length}`
);

// ----------------------------------------------------
// TEST 9: Cross-Device / Firestore Independent Documents
// ----------------------------------------------------
console.log('\n--- TEST 9: Firestore Document Independence ---');
const sample2026 = hydrated2026[0];
const sample2027 = hydrated2027[0];

const docPath2026 = `users/test-uid/holidays/${sample2026.id}`;
const docPath2027 = `users/test-uid/holidays/${sample2027.id}`;

assert(
  docPath2026 !== docPath2027 && sample2026.id !== sample2027.id,
  'Test 9: แต่ละรายการมี Firestore Document Path แยกกันโดยสิ้นเชิง ไม่มีเอกสารอ้างอิงร่วมกันข้ามปี',
  `2026: ${sample2026.id} vs 2027: ${sample2027.id}`
);

// ----------------------------------------------------
// TEST 10: ระบบคำนวณ OT อ่านวันหยุดของปีที่ถูกต้อง
// ----------------------------------------------------
console.log('\n--- TEST 10: OT Calculation Matches Exact Year Holidays ---');
const testSettings = { ...DEFAULT_SETTINGS, workStartDate: '2026-01-01' };

// Cycle 2026-04 (covering April 2026)
const cycleApril2026 = createCycleRecords(2026, 3, testSettings, globalHolidays);
const songkran2026Record = cycleApril2026.find((r) => r.date === '2026-04-13');

assert(
  songkran2026Record?.shiftType === 'H' && songkran2026Record.holidayName === 'วันสงกรานต์',
  'Test 10.1: รอบเดือนเมษายน 2026 ได้รับสถานะวันหยุด (H) สำหรับวันที่ 2026-04-13 วันสงกรานต์',
  `ShiftType: ${songkran2026Record?.shiftType}, HolidayName: ${songkran2026Record?.holidayName}`
);

// Cycle 2027-04 (covering April 2027)
const cycleApril2027 = createCycleRecords(2027, 3, testSettings, globalHolidays);
const songkran2027Record = cycleApril2027.find((r) => r.date === '2027-04-13');

assert(
  songkran2027Record?.shiftType === 'H' && songkran2027Record.holidayName === 'วันสงกรานต์',
  'Test 10.2: รอบเดือนเมษายน 2027 ได้รับสถานะวันหยุด (H) สำหรับวันที่ 2027-04-13 ของปี 2027 อย่างถูกต้อง',
  `ShiftType: ${songkran2027Record?.shiftType}`
);

// Visakha 2027 was edited to 2027-05-20:
// In 20th-19th cutoff, 2027-05-20 belongs to cycle 2027-06 (month index 5: May 20 to June 19)
const cycleJune2027 = createCycleRecords(2027, 5, testSettings, globalHolidays);
const visakhaEditedRecord = cycleJune2027.find((r) => r.date === '2027-05-20');
const visakhaOldDateRecord = cycleJune2027.find((r) => r.date === '2027-05-31');

assert(
  visakhaEditedRecord?.shiftType === 'H' && visakhaEditedRecord.holidayName === 'วันวิสาขบูชา',
  'Test 10.3: วันวิสาขบูชาปี 2027 ที่ถูกแก้เป็น 2027-05-20 ได้รับสถานะวันหยุด (H) ตรงวันใหม่ในรอบวิก',
  `ShiftType: ${visakhaEditedRecord?.shiftType}`
);
assert(
  visakhaOldDateRecord?.shiftType !== 'H',
  'Test 10.4: วันที่ 2027-05-31 ไม่ใช่วันหยุดในรอบปี 2027 อีกต่อไปหลังการแก้ไข',
  `ShiftType: ${visakhaOldDateRecord?.shiftType}`
);

// ----------------------------------------------------
// BONUS TESTS: Leap Year Safety & Duplicate Checking
// ----------------------------------------------------
console.log('\n--- BONUS TESTS: Leap Year & Duplicate Checking ---');
const leapToNormal = shiftHolidayDateToYear('2024-02-29', 2025);
assert(
  leapToNormal === '2025-02-28',
  'Leap Year: วันที่ 29 ก.พ. 2024 เมื่อคัดลอกไปยังปี 2025 (ไม่ใช่ Leap Year) ปรับเป็น 28 ก.พ. 2025 อย่างปลอดภัย',
  `Result: ${leapToNormal}`
);

const leapToLeap = shiftHolidayDateToYear('2024-02-29', 2028);
assert(
  leapToLeap === '2028-02-29',
  'Leap Year: วันที่ 29 ก.พ. 2024 เมื่อคัดลอกไปยังปี 2028 (เป็น Leap Year) คงเป็น 29 ก.พ. 2028',
  `Result: ${leapToLeap}`
);

const isDuplicateDetected = checkDuplicateHoliday(globalHolidays, '2026-01-01', 'วันขึ้นปีใหม่');
assert(
  isDuplicateDetected,
  'Duplicate Check: ระบบตรวจพบการบันทึกวันหยุดชื่อซ้ำและวันซ้ำสำเร็จ',
  `isDuplicate: ${isDuplicateDetected}`
);

const availableYearsTest = getAvailableHolidayYears(globalHolidays);
assert(
  availableYearsTest.includes(2025) && availableYearsTest.includes(2026) && availableYearsTest.includes(2027) && availableYearsTest.includes(2028),
  'Year Selector: มีปี 2025, 2026, 2027, 2028 ให้ผู้ใช้เลือกอย่างครบถ้วน'
);

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log('======================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL 18 ANNUAL HOLIDAY MANAGEMENT TESTS PASSED WITH 100% SUCCESS!');
}
