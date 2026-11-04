import { 
  getAnnualLeavePeriod, 
  isDateInAnnualLeavePeriod, 
  AnnualLeavePeriod 
} from '../src/utils/calculator';
import { DailyRecord } from '../src/types/overtime';

console.log('====================================================');
console.log('🧪 RUNNING ANNUAL LEAVE PERIOD & BOUNDARY AUDIT TESTS');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

// ----------------------------------------------------
// TEST SUITE 1: getAnnualLeavePeriod period boundary calculation
// ----------------------------------------------------
console.log('--- TEST SUITE 1: getAnnualLeavePeriod period boundary ---');
const period2026 = getAnnualLeavePeriod(2026, 12, 20, 19);
assert(period2026.startDate === '2025-12-20', 'Leave Year 2026 start date is 2025-12-20', `Got ${period2026.startDate}`);
assert(period2026.endDate === '2026-12-19', 'Leave Year 2026 end date is 2026-12-19', `Got ${period2026.endDate}`);
assert(period2026.startYear === 2025, 'Start year is 2025', `Got ${period2026.startYear}`);
assert(period2026.endYear === 2026, 'End year is 2026', `Got ${period2026.endYear}`);
assert(period2026.startDay === 20, 'Start day is 20', `Got ${period2026.startDay}`);
assert(period2026.endDay === 19, 'End day is 19', `Got ${period2026.endDay}`);
assert(period2026.label.includes('20 ธันวาคม 2025') && period2026.label.includes('19 ธันวาคม 2026'), 'Label includes full Thai text');
assert(period2026.shortLabel.includes('20 ธ.ค. 2025') && period2026.shortLabel.includes('19 ธ.ค. 2026'), 'Short label includes Thai abbreviations');

// Fallback / default testing when leaveYearStartMonth is undefined or 1
const defaultPeriod = getAnnualLeavePeriod(2026, undefined, 20, 19);
assert(defaultPeriod.startDate === '2025-12-20' && defaultPeriod.endDate === '2026-12-19', 'Default leaveYearStartMonth produces 2025-12-20 to 2026-12-19');

const month1Period = getAnnualLeavePeriod(2026, 1, 20, 19);
assert(month1Period.startDate === '2025-12-20' && month1Period.endDate === '2026-12-19', 'leaveYearStartMonth=1 gracefully resolves to 2025-12-20 to 2026-12-19');

// ----------------------------------------------------
// TEST SUITE 2: User-Specified Prompt Test Matrix (Leave Year 2026)
// ----------------------------------------------------
console.log('\n--- TEST SUITE 2: Prompt Specified Test Matrix (Leave Year 2026) ---');
const testMatrix: { date: string; expected: boolean; description: string }[] = [
  { date: '2025-12-19', expected: false, description: '2025-12-19 must be EXCLUDED (day before leave year)' },
  { date: '2025-12-20', expected: true,  description: '2025-12-20 MUST BE INCLUDED (FIRST DAY of leave year)' },
  { date: '2025-12-21', expected: true,  description: '2025-12-21 MUST BE INCLUDED' },
  { date: '2025-12-31', expected: true,  description: '2025-12-31 MUST BE INCLUDED (End of calendar year 2025)' },
  { date: '2026-01-01', expected: true,  description: '2026-01-01 MUST BE INCLUDED (Start of calendar year 2026)' },
  { date: '2026-12-19', expected: true,  description: '2026-12-19 MUST BE INCLUDED (LAST DAY of leave year)' },
  { date: '2026-12-20', expected: false, description: '2026-12-20 must be EXCLUDED (start of next leave year 2027)' },
];

testMatrix.forEach(({ date, expected, description }) => {
  const result = isDateInAnnualLeavePeriod(date, 2026, 12, 20, 19);
  assert(result === expected, description, `Date: ${date}, Expected: ${expected}, Got: ${result}`);
});

// ----------------------------------------------------
// TEST SUITE 3: YearlyLeaveView simulation with cycle records
// ----------------------------------------------------
console.log('\n--- TEST SUITE 3: YearlyLeaveView Record Collection Simulation ---');

const mockRecordsArray: DailyRecord[] = [
  {
    id: 'rec_2025_12_19',
    date: '2025-12-19',
    dayOfWeek: 'ศ.',
    shiftType: 'E', // Sick leave outside period
    shiftPeriod: 'DAY',
    actualWorkHours: 8,
    ot1_0: 0,
    ot1_5: 0,
    ot2_0: 0,
    ot3_0: 0,
    note: 'ลาป่วยรอบปีเก่า',
  },
  {
    id: 'rec_2025_12_20',
    date: '2025-12-20',
    dayOfWeek: 'ส.',
    shiftType: 'J', // Vacation on FIRST day of leave year
    shiftPeriod: 'DAY',
    actualWorkHours: 8,
    ot1_0: 0,
    ot1_5: 0,
    ot2_0: 0,
    ot3_0: 0,
    note: 'พักร้อนวันแรกของรอบปี 2026',
  },
  {
    id: 'rec_2025_12_21',
    date: '2025-12-21',
    dayOfWeek: 'อา.',
    shiftType: 'D', // Personal leave
    shiftPeriod: 'DAY',
    actualWorkHours: 8,
    ot1_0: 0,
    ot1_5: 0,
    ot2_0: 0,
    ot3_0: 0,
    note: 'ลากิจ',
  },
  {
    id: 'rec_2026_01_05',
    date: '2026-01-05',
    dayOfWeek: 'จ.',
    shiftType: 'E', // Sick leave
    shiftPeriod: 'DAY',
    actualWorkHours: 8,
    ot1_0: 0,
    ot1_5: 0,
    ot2_0: 0,
    ot3_0: 0,
    note: 'ลาป่วยต้นปี',
  },
  {
    id: 'rec_2026_12_19',
    date: '2026-12-19',
    dayOfWeek: 'ส.',
    shiftType: 'J', // Vacation on LAST day of leave year
    shiftPeriod: 'DAY',
    actualWorkHours: 8,
    ot1_0: 0,
    ot1_5: 0,
    ot2_0: 0,
    ot3_0: 0,
    note: 'พักร้อนวันสุดท้ายของรอบปี 2026',
  },
  {
    id: 'rec_2026_12_20',
    date: '2026-12-20',
    dayOfWeek: 'อา.',
    shiftType: 'J', // Vacation on next leave year
    shiftPeriod: 'DAY',
    actualWorkHours: 8,
    ot1_0: 0,
    ot1_5: 0,
    ot2_0: 0,
    ot3_0: 0,
    note: 'พักร้อนรอบปี 2027',
  },
];

const mockAllCycleRecords: Record<string, DailyRecord[]> = {
  '2026-01': mockRecordsArray.slice(0, 4),
  '2026-12': mockRecordsArray.slice(4),
};

// Simulate YearlyLeaveView logic
const leavePeriodSim = getAnnualLeavePeriod(2026, 12, 20, 19);
const list: DailyRecord[] = [];
const seenDates = new Set<string>();

Object.values(mockAllCycleRecords).forEach((recordsArray) => {
  recordsArray.forEach((r) => {
    if (!r.date) return;
    const recordDate = r.date.trim().slice(0, 10);
    if (
      (r.shiftType === 'E' || r.shiftType === 'D' || r.shiftType === 'J') &&
      recordDate >= leavePeriodSim.startDate &&
      recordDate <= leavePeriodSim.endDate &&
      !seenDates.has(recordDate)
    ) {
      seenDates.add(recordDate);
      list.push({ ...r, date: recordDate });
    }
  });
});

list.sort((a, b) => a.date.localeCompare(b.date));

const collectedDates = list.map((r) => r.date);
console.log('Collected leave dates in simulated YearlyLeaveView:', collectedDates);

assert(collectedDates.includes('2025-12-20'), 'CRITICAL: 2025-12-20 is present in the YearlyLeaveView leave list');
assert(collectedDates.includes('2025-12-21'), '2025-12-21 is present');
assert(collectedDates.includes('2026-01-05'), '2026-01-05 is present');
assert(collectedDates.includes('2026-12-19'), '2026-12-19 is present');
assert(!collectedDates.includes('2025-12-19'), '2025-12-19 is NOT present');
assert(!collectedDates.includes('2026-12-20'), '2026-12-20 is NOT present');
assert(collectedDates.length === 4, `Expected exactly 4 leave records, got ${collectedDates.length}`);

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
}
