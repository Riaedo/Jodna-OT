import { 
  getCyclePeriodForDate, 
  getCyclePeriodForYearMonth, 
  isSamePeriod, 
  getBangkokDateString 
} from '../src/utils/calculator';

interface TestCase {
  name: string;
  testDate: string;
  expectedPeriodStart: string;
  expectedPeriodEnd: string;
  expectedCycleKey: string;
  expectedCycleYear: number;
  expectedCycleMonth: number;
}

const TEST_CASES: TestCase[] = [
  {
    name: '4 พ.ย. 2026 -> รอบ 20 ต.ค. - 19 พ.ย. 2026',
    testDate: '2026-11-04',
    expectedPeriodStart: '2026-10-20',
    expectedPeriodEnd: '2026-11-19',
    expectedCycleKey: '2026-11',
    expectedCycleYear: 2026,
    expectedCycleMonth: 10,
  },
  {
    name: '19 พ.ย. 2026 (วันสุดท้ายของรอบ) -> รอบ 20 ต.ค. - 19 พ.ย. 2026',
    testDate: '2026-11-19',
    expectedPeriodStart: '2026-10-20',
    expectedPeriodEnd: '2026-11-19',
    expectedCycleKey: '2026-11',
    expectedCycleYear: 2026,
    expectedCycleMonth: 10,
  },
  {
    name: '20 พ.ย. 2026 (วันแรกของรอบถัดไป) -> รอบ 20 พ.ย. - 19 ธ.ค. 2026',
    testDate: '2026-11-20',
    expectedPeriodStart: '2026-11-20',
    expectedPeriodEnd: '2026-12-19',
    expectedCycleKey: '2026-12',
    expectedCycleYear: 2026,
    expectedCycleMonth: 11,
  },
  {
    name: '5 ม.ค. 2027 (ข้ามปีใหม่) -> รอบ 20 ธ.ค. 2026 - 19 ม.ค. 2027',
    testDate: '2027-01-05',
    expectedPeriodStart: '2026-12-20',
    expectedPeriodEnd: '2027-01-19',
    expectedCycleKey: '2027-01',
    expectedCycleYear: 2027,
    expectedCycleMonth: 0,
  },
  {
    name: '1 มี.ค. 2028 (ปีอธิกสุรทิน Leap Year) -> รอบ 20 ก.พ. - 19 มี.ค. 2028',
    testDate: '2028-03-01',
    expectedPeriodStart: '2028-02-20',
    expectedPeriodEnd: '2028-03-19',
    expectedCycleKey: '2028-03',
    expectedCycleYear: 2028,
    expectedCycleMonth: 2,
  },
];

async function runTests() {
  console.log('======================================================================');
  console.log('📅 OT PERIOD LOGIC & CURRENT CYCLE BUTTON AUTOMATED TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Period Calculation Tests
  TEST_CASES.forEach((tc, idx) => {
    const result = getCyclePeriodForDate(tc.testDate, 20, 19);
    const pass = 
      result.periodStart === tc.expectedPeriodStart &&
      result.periodEnd === tc.expectedPeriodEnd &&
      result.cycleKey === tc.expectedCycleKey &&
      result.cycleYear === tc.expectedCycleYear &&
      result.cycleMonth === tc.expectedCycleMonth;

    if (pass) {
      console.log(`✅ [PASS] Scenario ${idx + 1}: ${tc.name}`);
      console.log(`   Start: ${result.periodStart} | End: ${result.periodEnd} | CycleKey: ${result.cycleKey}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] Scenario ${idx + 1}: ${tc.name}`);
      console.log(`   Expected: ${tc.expectedPeriodStart} to ${tc.expectedPeriodEnd} (${tc.expectedCycleKey})`);
      console.log(`   Actual:   ${result.periodStart} to ${result.periodEnd} (${result.cycleKey})`);
      failed++;
    }
  });

  console.log('\n--- Button Visibility & Interaction Tests ---');

  // Condition 1: When user is viewing the CURRENT cycle (e.g. 2026-11 on 2026-11-04)
  const currentPeriod = getCyclePeriodForDate('2026-11-04', 20, 19);
  const viewingCurrentCycle = getCyclePeriodForYearMonth(currentPeriod.cycleYear, currentPeriod.cycleMonth, 20, 19);
  const isCurrentActive = isSamePeriod(viewingCurrentCycle, currentPeriod);

  if (isCurrentActive) {
    console.log('✅ [PASS] Condition 1: เมื่อเลือกรอบปัจจุบัน -> isCurrentPeriod = true (ซ่อนปุ่มกลับรอบปัจจุบัน)');
    passed++;
  } else {
    console.log('❌ [FAIL] Condition 1: เมื่อเลือกรอบปัจจุบัน -> ปุ่มยังคงแสดง');
    failed++;
  }

  // Condition 2: When user views a PREVIOUS cycle (e.g. 2026-10)
  const viewingPrevCycle = getCyclePeriodForYearMonth(2026, 9, 20, 19); // 20 Sep - 19 Oct 2026
  const isPrevActive = isSamePeriod(viewingPrevCycle, currentPeriod);

  if (!isPrevActive) {
    console.log('✅ [PASS] Condition 2: เมื่อเลือกรอบย้อนหลัง -> isCurrentPeriod = false (แสดงปุ่มกลับรอบปัจจุบัน)');
    passed++;
  } else {
    console.log('❌ [FAIL] Condition 2: เมื่อเลือกรอบย้อนหลัง -> ซ่อนปุ่มผิดพลาด');
    failed++;
  }

  // Condition 3: When user views a FUTURE cycle (e.g. 2026-12)
  const viewingFutureCycle = getCyclePeriodForYearMonth(2026, 11, 20, 19); // 20 Nov - 19 Dec 2026
  const isFutureActive = isSamePeriod(viewingFutureCycle, currentPeriod);

  if (!isFutureActive) {
    console.log('✅ [PASS] Condition 3: เมื่อเลือกรอบอนาคต -> isCurrentPeriod = false (แสดงปุ่มกลับรอบปัจจุบัน)');
    passed++;
  } else {
    console.log('❌ [FAIL] Condition 3: เมื่อเลือกรอบอนาคต -> ซ่อนปุ่มผิดพลาด');
    failed++;
  }

  // Condition 4: Clicking "Reset to Current Cycle" updates target cycle to current
  let simulatedSelectedCycle = { ...viewingPrevCycle };
  // User clicks return to current cycle
  simulatedSelectedCycle = getCyclePeriodForYearMonth(currentPeriod.cycleYear, currentPeriod.cycleMonth, 20, 19);
  const isNowCurrent = isSamePeriod(simulatedSelectedCycle, currentPeriod);

  if (isNowCurrent) {
    console.log('✅ [PASS] Condition 4: เมื่อกดปุ่มกลับรอบปัจจุบัน -> สลับเป็นรอบปัจจุบันทันที และซ่อนปุ่มอัตโนมัติ');
    passed++;
  } else {
    console.log('❌ [FAIL] Condition 4: กดปุ่มแล้วไม่สามารถสลับเป็นรอบปัจจุบันได้');
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`📊 TEST SUMMARY: Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
