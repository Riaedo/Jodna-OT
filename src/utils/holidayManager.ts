import { Holiday } from '../types/overtime';

/**
 * Shifts a YYYY-MM-DD date string to a new target year, preserving month and day.
 * Safely handles leap year edge cases (e.g. Feb 29 on non-leap years -> Feb 28).
 */
export function shiftHolidayDateToYear(dateStr: string, targetYear: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return `${targetYear}-01-01`;
  }

  const month = parseInt(parts[1], 10);
  let day = parseInt(parts[2], 10);

  // Handle Feb 29 in non-leap year
  if (month === 2 && day === 29) {
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    if (!isLeap) {
      day = 28;
    }
  }

  // Ensure day does not exceed month max days
  const maxDays = new Date(targetYear, month, 0).getDate();
  const safeDay = Math.min(day, maxDays);

  const padM = String(month).padStart(2, '0');
  const padD = String(safeDay).padStart(2, '0');
  return `${targetYear}-${padM}-${padD}`;
}

/**
 * Filter holidays strictly belonging to a specific calendar year.
 */
export function filterHolidaysByYear(holidays: Holiday[], year: number): Holiday[] {
  const prefix = `${year}-`;
  return holidays
    .filter((h) => h.date && h.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get sorted list of distinct years present in holidays, merged with standard years (e.g. 2025, 2026, 2027, 2028).
 */
export function getAvailableHolidayYears(holidays: Holiday[], defaultYears: number[] = [2025, 2026, 2027, 2028]): number[] {
  const yearSet = new Set<number>(defaultYears);
  holidays.forEach((h) => {
    if (h.date && h.date.length >= 4) {
      const y = parseInt(h.date.substring(0, 4), 10);
      if (!isNaN(y)) {
        yearSet.add(y);
      }
    }
  });
  return Array.from(yearSet).sort((a, b) => a - b);
}

/**
 * Check if the target year can be created from a previous year template.
 */
export function canCopyHolidaysFromYear(
  holidays: Holiday[],
  targetYear: number,
  preferredSourceYear?: number
): {
  canCopy: boolean;
  sourceYear?: number;
  sourceCount: number;
  existingCount: number;
  reason?: string;
} {
  const existingTarget = filterHolidaysByYear(holidays, targetYear);
  if (existingTarget.length > 0) {
    return {
      canCopy: false,
      sourceCount: 0,
      existingCount: existingTarget.length,
      reason: `ปี ${targetYear} มีรายการวันหยุดอยู่แล้ว ${existingTarget.length} รายการ ห้ามเขียนทับข้อมูลเดิม`,
    };
  }

  // Determine source year: user preference, or targetYear - 1, or the latest available year < targetYear
  let sourceY = preferredSourceYear;
  if (!sourceY) {
    const defaultPrev = targetYear - 1;
    const prevItems = filterHolidaysByYear(holidays, defaultPrev);
    if (prevItems.length > 0) {
      sourceY = defaultPrev;
    } else {
      // Find the closest prior year with holidays
      const allYears = getAvailableHolidayYears(holidays, [])
        .filter((y) => y < targetYear)
        .reverse();
      for (const y of allYears) {
        if (filterHolidaysByYear(holidays, y).length > 0) {
          sourceY = y;
          break;
        }
      }
    }
  }

  if (!sourceY) {
    return {
      canCopy: false,
      sourceCount: 0,
      existingCount: 0,
      reason: `ไม่พบข้อมูลวันหยุดในปีก่อนหน้าสำหรับนำมาเป็นต้นแบบ`,
    };
  }

  const sourceItems = filterHolidaysByYear(holidays, sourceY);
  if (sourceItems.length === 0) {
    return {
      canCopy: false,
      sourceYear: sourceY,
      sourceCount: 0,
      existingCount: 0,
      reason: `ปีต้นแบบ ${sourceY} ไม่มีรายการวันหยุด`,
    };
  }

  return {
    canCopy: true,
    sourceYear: sourceY,
    sourceCount: sourceItems.length,
    existingCount: 0,
  };
}

/**
 * Copies holidays from sourceYear to targetYear.
 * Generates fresh unique IDs, updates date strings, attaches sourceYear audit metadata.
 * Returns newly created holidays and does NOT mutate source holidays.
 */
export function copyHolidaysToYear(
  holidays: Holiday[],
  sourceYear: number,
  targetYear: number
): {
  newHolidays: Holiday[];
  copiedCount: number;
} {
  // Guard check: Do not overwrite if targetYear already has holidays
  const existingTarget = filterHolidaysByYear(holidays, targetYear);
  if (existingTarget.length > 0) {
    throw new Error(`ปีเป้าหมาย ${targetYear} มีข้อมูลวันหยุดอยู่แล้ว (${existingTarget.length} รายการ) ห้ามเขียนทับ`);
  }

  const sourceItems = filterHolidaysByYear(holidays, sourceYear);
  if (sourceItems.length === 0) {
    throw new Error(`ไม่พบรายการวันหยุดในรอบปีต้นแบบ ${sourceYear}`);
  }

  const timestamp = Date.now();
  const createdList: Holiday[] = sourceItems.map((item, index) => {
    const newDate = shiftHolidayDateToYear(item.date, targetYear);
    const uniqueId = `hol-${targetYear}-${timestamp}-${index}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      id: uniqueId,
      date: newDate,
      name: item.name,
      type: item.type || 'PUBLIC',
      isCustom: true,
      note: item.note || '',
      sourceYear: sourceYear,
    };
  });

  return {
    newHolidays: createdList,
    copiedCount: createdList.length,
  };
}

/**
 * Check if a holiday with same date and name already exists (warning check).
 */
export function checkDuplicateHoliday(
  holidays: Holiday[],
  date: string,
  name: string,
  excludeId?: string
): boolean {
  const normName = name.trim().toLowerCase();
  const normDate = date.trim();

  return holidays.some(
    (h) => h.id !== excludeId && h.date === normDate && h.name.trim().toLowerCase() === normName
  );
}
