import { DailyRecord, Holiday, PayrollSettings } from '../types/overtime';
import { DEFAULT_SETTINGS } from '../data/initialData';
import { createCycleRecords, isValidDateString } from './calculator';

/**
 * Point 1: Resolve active records for the selected cycle without hiding
 * existing saved records even when `settings.workStartDate` is empty.
 */
export function resolveCurrentCycleRecords(
  allCycleRecords: Record<string, DailyRecord[]>,
  cycleKey: string,
  hasWorkStartDate: boolean,
  targetYear: number,
  targetMonth: number,
  settings: PayrollSettings,
  holidays: Holiday[]
): DailyRecord[] {
  const existingCycle = allCycleRecords[cycleKey];
  if (existingCycle && existingCycle.length > 0) {
    return existingCycle.filter((r) => isValidDateString(r.date));
  }
  if (!hasWorkStartDate) {
    return [];
  }
  return createCycleRecords(targetYear, targetMonth, settings, holidays);
}

/**
 * Point 2: Merge remote Firestore settings safely without letting an empty
 * `remoteSettings.workStartDate` clobber cached or default `workStartDate`.
 */
export function buildSettingsFromRemote(
  remoteSettings: PayrollSettings | null,
  hasCachedData: boolean,
  cachedSettings?: PayrollSettings | null
): PayrollSettings {
  if (!remoteSettings) {
    return {
      ...DEFAULT_SETTINGS,
      ...(hasCachedData && cachedSettings ? cachedSettings : {}),
    };
  }

  const remoteStart =
    typeof remoteSettings.workStartDate === 'string'
      ? remoteSettings.workStartDate.trim()
      : '';
  const cachedStart =
    hasCachedData && typeof cachedSettings?.workStartDate === 'string'
      ? cachedSettings.workStartDate.trim()
      : '';
  const defaultStart =
    typeof DEFAULT_SETTINGS.workStartDate === 'string'
      ? DEFAULT_SETTINGS.workStartDate.trim()
      : '';

  return {
    ...DEFAULT_SETTINGS,
    ...remoteSettings,
    yearlyVacationQuotas:
      remoteSettings.yearlyVacationQuotas || DEFAULT_SETTINGS.yearlyVacationQuotas,
    workStartDate: remoteStart || cachedStart || defaultStart || '',
  };
}

/**
 * Point 3: Sanitize a DailyRecord and merge it into the cycle record list
 * matching by `date` or `id`, preserving existing `id`, or appending & sorting by `date`.
 */
export function sanitizeDailyRecord(updated: DailyRecord): DailyRecord {
  return {
    ...updated,
    ot1_0: Number(updated.ot1_0) || 0,
    ot1_5: Number(updated.ot1_5) || 0,
    ot2_0: Number(updated.ot2_0) || 0,
    ot3_0: Number(updated.ot3_0) || 0,
    isBeforeWorkStart: false,
  };
}

export function applyUpdatedRecordToCycle(
  baseList: DailyRecord[],
  cleanUpdated: DailyRecord
): DailyRecord[] {
  let matched = false;
  const mapped = baseList.map((r) => {
    if (r.date === cleanUpdated.date || r.id === cleanUpdated.id) {
      matched = true;
      return {
        ...cleanUpdated,
        id: r.id || cleanUpdated.id,
      };
    }
    return r;
  });

  if (!matched) {
    mapped.push(cleanUpdated);
    mapped.sort((a, b) => a.date.localeCompare(b.date));
  }

  return mapped;
}

/**
 * Determine a safe default workStartDate when saving an OT record while
 * `settings.workStartDate` is empty (`${targetYear}-01-01`, or earlier year
 * if `recordDate` is in December of the previous year for a January cycle).
 */
export function deriveAutoWorkStartDate(recordDate: string, targetYear: number): string {
  const defaultStart = `${targetYear}-01-01`;
  if (isValidDateString(recordDate) && recordDate < defaultStart) {
    return `${recordDate.slice(0, 4)}-01-01`;
  }
  return defaultStart;
}
