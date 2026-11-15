import { DailyRecord, Holiday, PayrollSettings, SalaryIncrementRecord } from '../types/overtime';
import { DEFAULT_SETTINGS } from '../data/initialData';
import { auth } from '../firebase';
import {
  saveUserSettings,
  saveUserCycle,
  saveUserHolidays,
  deleteUserHoliday,
  saveUserSalaryIncrements,
  deleteUserSalaryIncrement,
} from './firestoreSync';

export type PendingSyncType =
  | 'SAVE_SETTINGS'
  | 'SAVE_CYCLE'
  | 'SAVE_HOLIDAYS'
  | 'DELETE_HOLIDAY'
  | 'SAVE_SALARY_INCREMENTS'
  | 'DELETE_SALARY_INCREMENT';

export interface PendingSyncItem {
  id: string;
  uid: string;
  type: PendingSyncType;
  payload: any;
  timestamp: number;
}

export interface UserLocalCacheData {
  settings: PayrollSettings;
  allCycleRecords: Record<string, DailyRecord[]>;
  cycleTaxes: Record<string, number>;
  holidays: Holiday[];
  salaryIncrements: SalaryIncrementRecord[];
  appliedResetVersion: string | null;
  hasCachedData: boolean;
}

const LEGACY_UNSCOPED_KEYS = [
  'ot_app_holidays_v5',
  'ot_app_settings_v8',
  'ot_app_salary_increments_v2',
  'ot_app_all_cycles_v8',
  'ot_app_cycle_taxes_v3',
  'ot_app_applied_reset_version',
];

function getUidCacheKeys(uid: string) {
  const prefix = `ot_app_u_${uid}_`;
  return {
    prefix,
    settings: `${prefix}settings_v1`,
    cycles: `${prefix}all_cycles_v1`,
    taxes: `${prefix}cycle_taxes_v1`,
    holidays: `${prefix}holidays_v1`,
    increments: `${prefix}salary_increments_v1`,
    resetVersion: `${prefix}applied_reset_version`,
    pendingSync: `${prefix}pending_sync_v1`,
  };
}

/**
 * Remove any legacy unscoped ot_app_* keys (preserving theme and UID-scoped ot_app_u_* keys).
 */
export function purgeLegacyUnscopedOtKeys(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (LEGACY_UNSCOPED_KEYS.includes(key)) {
        toRemove.push(key);
      } else if (key.startsWith('ot_app_') && !key.startsWith('ot_app_u_')) {
        toRemove.push(key);
      } else if (key.startsWith('gemini_supabase_')) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.error('Failed to purge legacy unscoped keys:', e);
  }
}

/**
 * Read pending sync queue strictly for the given UID.
 */
export function getPendingSyncQueue(uid: string): PendingSyncItem[] {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const keys = getUidCacheKeys(uid);
    const raw = localStorage.getItem(keys.pendingSync);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Strict UID isolation: ignore any entry whose uid does not match
    return parsed.filter((item: any) => item && item.uid === uid && item.type);
  } catch (e) {
    console.error('Failed to read pending sync queue:', e);
    return [];
  }
}

export function hasPendingSync(uid: string): boolean {
  return getPendingSyncQueue(uid).length > 0;
}

function writePendingSyncQueue(uid: string, queue: PendingSyncItem[]): void {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keys = getUidCacheKeys(uid);
    if (queue.length === 0) {
      localStorage.removeItem(keys.pendingSync);
    } else {
      localStorage.setItem(keys.pendingSync, JSON.stringify(queue));
    }
  } catch (e) {
    console.error('Failed to write pending sync queue:', e);
  }
}

/**
 * Enqueue an offline mutation strictly bound to `uid`, coalescing redundant updates safely.
 */
export function enqueuePendingSync(
  uid: string,
  type: PendingSyncType,
  payload: any
): void {
  if (!uid) return;
  const current = getPendingSyncQueue(uid);
  const now = Date.now();
  const nextId = `${type}_${now}_${Math.random().toString(36).slice(2, 7)}`;

  let filtered = current;

  if (type === 'SAVE_SETTINGS') {
    filtered = current.filter((item) => item.type !== 'SAVE_SETTINGS');
  } else if (type === 'SAVE_CYCLE') {
    const cKey = payload?.cycleKey;
    filtered = current.filter(
      (item) => !(item.type === 'SAVE_CYCLE' && item.payload?.cycleKey === cKey)
    );
  } else if (type === 'SAVE_HOLIDAYS') {
    filtered = current.filter((item) => item.type !== 'SAVE_HOLIDAYS');
  } else if (type === 'DELETE_HOLIDAY') {
    const holId = payload?.holidayId;
    filtered = current
      .map((item) => {
        if (item.type === 'SAVE_HOLIDAYS' && Array.isArray(item.payload?.holidays)) {
          return {
            ...item,
            payload: {
              holidays: item.payload.holidays.filter((h: Holiday) => h.id !== holId),
            },
          };
        }
        return item;
      })
      .filter(
        (item) =>
          !(item.type === 'DELETE_HOLIDAY' && item.payload?.holidayId === holId) &&
          !(item.type === 'SAVE_HOLIDAYS' && (!item.payload?.holidays || item.payload.holidays.length === 0))
      );
  } else if (type === 'SAVE_SALARY_INCREMENTS') {
    filtered = current.filter((item) => item.type !== 'SAVE_SALARY_INCREMENTS');
  } else if (type === 'DELETE_SALARY_INCREMENT') {
    const recId = payload?.recordId;
    filtered = current
      .map((item) => {
        if (item.type === 'SAVE_SALARY_INCREMENTS' && Array.isArray(item.payload?.records)) {
          return {
            ...item,
            payload: {
              records: item.payload.records.filter((r: SalaryIncrementRecord) => r.id !== recId),
            },
          };
        }
        return item;
      })
      .filter(
        (item) =>
          !(item.type === 'DELETE_SALARY_INCREMENT' && item.payload?.recordId === recId) &&
          !(
            item.type === 'SAVE_SALARY_INCREMENTS' &&
            (!item.payload?.records || item.payload.records.length === 0)
          )
      );
  }

  filtered.push({
    id: nextId,
    uid,
    type,
    payload,
    timestamp: now,
  });

  writePendingSyncQueue(uid, filtered);
}

export function clearPendingSyncQueue(uid: string): void {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(getUidCacheKeys(uid).pendingSync);
  } catch (e) {
    console.error('Failed to clear pending sync queue:', e);
  }
}

/**
 * Flush queued offline mutations strictly for `uid`.
 * Aborts immediately if active session UID changes or goes offline mid-flush.
 */
export async function flushPendingSyncQueue(
  uid: string,
  getActiveUid: () => string | null = () => auth.currentUser?.uid ?? null
): Promise<{ flushed: number; remaining: number }> {
  if (!uid) return { flushed: 0, remaining: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { flushed: 0, remaining: getPendingSyncQueue(uid).length };
  }

  const queue = getPendingSyncQueue(uid);
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  let flushedCount = 0;
  const completedIds = new Set<string>();

  for (const item of queue) {
    // Strict UID & session verification before every single Firestore write
    if (item.uid !== uid || getActiveUid() !== uid || auth.currentUser?.uid !== uid) {
      break;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      break;
    }

    try {
      switch (item.type) {
        case 'SAVE_SETTINGS':
          if (item.payload?.settings) {
            await saveUserSettings(uid, item.payload.settings);
          }
          break;
        case 'SAVE_CYCLE':
          if (item.payload?.cycleKey && Array.isArray(item.payload?.records)) {
            await saveUserCycle(
              uid,
              item.payload.cycleKey,
              item.payload.records,
              item.payload.taxPaid
            );
          }
          break;
        case 'SAVE_HOLIDAYS':
          if (Array.isArray(item.payload?.holidays) && item.payload.holidays.length > 0) {
            await saveUserHolidays(uid, item.payload.holidays);
          }
          break;
        case 'DELETE_HOLIDAY':
          if (item.payload?.holidayId) {
            await deleteUserHoliday(uid, item.payload.holidayId);
          }
          break;
        case 'SAVE_SALARY_INCREMENTS':
          if (Array.isArray(item.payload?.records) && item.payload.records.length > 0) {
            await saveUserSalaryIncrements(uid, item.payload.records);
          }
          break;
        case 'DELETE_SALARY_INCREMENT':
          if (item.payload?.recordId) {
            await deleteUserSalaryIncrement(uid, item.payload.recordId);
          }
          break;
      }

      // Verify UID is still active before marking done
      if (getActiveUid() !== uid) {
        completedIds.add(item.id);
        flushedCount += 1;
        break;
      }

      completedIds.add(item.id);
      flushedCount += 1;
    } catch (err) {
      console.warn(`Pending sync item ${item.id} (${item.type}) paused:`, err);
      break;
    }
  }

  if (completedIds.size > 0) {
    const latestQueue = getPendingSyncQueue(uid);
    const remainingQueue = latestQueue.filter((q) => !completedIds.has(q.id));
    writePendingSyncQueue(uid, remainingQueue);
    return { flushed: flushedCount, remaining: remainingQueue.length };
  }

  return { flushed: flushedCount, remaining: getPendingSyncQueue(uid).length };
}

/**
 * Save user data to UID-scoped LocalStorage cache.
 */
export function saveUserLocalCache(
  uid: string,
  data: Partial<{
    settings: PayrollSettings;
    allCycleRecords: Record<string, DailyRecord[]>;
    cycleTaxes: Record<string, number>;
    holidays: Holiday[];
    salaryIncrements: SalaryIncrementRecord[];
    appliedResetVersion: string;
  }>
): void {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return;
  const keys = getUidCacheKeys(uid);
  try {
    if (data.settings !== undefined) {
      localStorage.setItem(keys.settings, JSON.stringify(data.settings));
    }
    if (data.allCycleRecords !== undefined) {
      localStorage.setItem(keys.cycles, JSON.stringify(data.allCycleRecords));
    }
    if (data.cycleTaxes !== undefined) {
      localStorage.setItem(keys.taxes, JSON.stringify(data.cycleTaxes));
    }
    if (data.holidays !== undefined) {
      localStorage.setItem(keys.holidays, JSON.stringify(data.holidays));
    }
    if (data.salaryIncrements !== undefined) {
      localStorage.setItem(keys.increments, JSON.stringify(data.salaryIncrements));
    }
    if (data.appliedResetVersion !== undefined) {
      localStorage.setItem(keys.resetVersion, data.appliedResetVersion);
    }
  } catch (e) {
    console.error('Failed to save UID-scoped local cache:', e);
  }
}

/**
 * Apply any pending offline sync items for `uid` on top of base state (e.g. cloud snapshot or local cache)
 * so unsynced offline edits are preserved and visible when the same UID logs back in.
 */
export function overlayPendingSyncOnSettings(uid: string, base: PayrollSettings): PayrollSettings {
  const queue = getPendingSyncQueue(uid);
  let result = base;
  for (const item of queue) {
    if (item.type === 'SAVE_SETTINGS' && item.payload?.settings) {
      result = {
        ...DEFAULT_SETTINGS,
        ...item.payload.settings,
      };
    }
  }
  return result;
}

export function overlayPendingSyncOnCycles(
  uid: string,
  baseCycles: Record<string, DailyRecord[]>,
  baseTaxes: Record<string, number>
): { cycles: Record<string, DailyRecord[]>; taxes: Record<string, number> } {
  const queue = getPendingSyncQueue(uid);
  const cycles = { ...baseCycles };
  const taxes = { ...baseTaxes };

  for (const item of queue) {
    if (item.type === 'SAVE_CYCLE' && item.payload?.cycleKey) {
      if (Array.isArray(item.payload.records)) {
        cycles[item.payload.cycleKey] = item.payload.records;
      }
      if (typeof item.payload.taxPaid === 'number') {
        taxes[item.payload.cycleKey] = item.payload.taxPaid;
      }
    }
  }
  return { cycles, taxes };
}

export function overlayPendingSyncOnHolidays(uid: string, baseHolidays: Holiday[]): Holiday[] {
  const queue = getPendingSyncQueue(uid);
  let result = [...baseHolidays];
  for (const item of queue) {
    if (item.type === 'SAVE_HOLIDAYS' && Array.isArray(item.payload?.holidays)) {
      const map = new Map<string, Holiday>();
      result.forEach((h) => map.set(h.id, h));
      item.payload.holidays.forEach((h: Holiday) => map.set(h.id, h));
      result = Array.from(map.values());
    } else if (item.type === 'DELETE_HOLIDAY' && item.payload?.holidayId) {
      result = result.filter((h) => h.id !== item.payload.holidayId);
    }
  }
  return result;
}

export function overlayPendingSyncOnIncrements(
  uid: string,
  baseIncrements: SalaryIncrementRecord[]
): SalaryIncrementRecord[] {
  const queue = getPendingSyncQueue(uid);
  let result = [...baseIncrements];
  for (const item of queue) {
    if (item.type === 'SAVE_SALARY_INCREMENTS' && Array.isArray(item.payload?.records)) {
      const map = new Map<string, SalaryIncrementRecord>();
      result.forEach((r) => map.set(r.id, r));
      item.payload.records.forEach((r: SalaryIncrementRecord) => map.set(r.id, r));
      result = Array.from(map.values());
    } else if (item.type === 'DELETE_SALARY_INCREMENT' && item.payload?.recordId) {
      result = result.filter((r) => r.id !== item.payload.recordId);
    }
  }
  return result;
}

/**
 * Load UID-scoped LocalStorage cache + overlay pending sync queue for that exact UID.
 */
export function loadUserLocalCache(uid: string): UserLocalCacheData {
  const empty: UserLocalCacheData = {
    settings: { ...DEFAULT_SETTINGS },
    allCycleRecords: {},
    cycleTaxes: {},
    holidays: [],
    salaryIncrements: [],
    appliedResetVersion: null,
    hasCachedData: false,
  };

  if (!uid || typeof window === 'undefined' || !window.localStorage) return empty;
  const keys = getUidCacheKeys(uid);

  try {
    let hasCachedData = false;
    let settings: PayrollSettings = { ...DEFAULT_SETTINGS };
    const rawSettings = localStorage.getItem(keys.settings);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        yearlyVacationQuotas: parsed.yearlyVacationQuotas || DEFAULT_SETTINGS.yearlyVacationQuotas,
        workStartDate: parsed.workStartDate !== undefined ? parsed.workStartDate : '',
      };
      hasCachedData = true;
    }

    let allCycleRecords: Record<string, DailyRecord[]> = {};
    const rawCycles = localStorage.getItem(keys.cycles);
    if (rawCycles) {
      const parsed = JSON.parse(rawCycles);
      if (parsed && typeof parsed === 'object') {
        allCycleRecords = parsed;
        hasCachedData = true;
      }
    }

    let cycleTaxes: Record<string, number> = {};
    const rawTaxes = localStorage.getItem(keys.taxes);
    if (rawTaxes) {
      const parsed = JSON.parse(rawTaxes);
      if (parsed && typeof parsed === 'object') {
        cycleTaxes = parsed;
        hasCachedData = true;
      }
    }

    let holidays: Holiday[] = [];
    const rawHolidays = localStorage.getItem(keys.holidays);
    if (rawHolidays) {
      const parsed = JSON.parse(rawHolidays);
      if (Array.isArray(parsed)) {
        holidays = parsed;
        hasCachedData = true;
      }
    }

    let salaryIncrements: SalaryIncrementRecord[] = [];
    const rawIncrements = localStorage.getItem(keys.increments);
    if (rawIncrements) {
      const parsed = JSON.parse(rawIncrements);
      if (Array.isArray(parsed)) {
        salaryIncrements = parsed;
        hasCachedData = true;
      }
    }

    const appliedResetVersion = localStorage.getItem(keys.resetVersion);

    // Overlay any pending offline mutations for this exact UID
    settings = overlayPendingSyncOnSettings(uid, settings);
    const overlaidCycles = overlayPendingSyncOnCycles(uid, allCycleRecords, cycleTaxes);
    allCycleRecords = overlaidCycles.cycles;
    cycleTaxes = overlaidCycles.taxes;
    holidays = overlayPendingSyncOnHolidays(uid, holidays);
    salaryIncrements = overlayPendingSyncOnIncrements(uid, salaryIncrements);

    if (hasPendingSync(uid)) {
      hasCachedData = true;
    }

    return {
      settings,
      allCycleRecords,
      cycleTaxes,
      holidays,
      salaryIncrements,
      appliedResetVersion,
      hasCachedData,
    };
  } catch (e) {
    console.error('Failed to load UID-scoped local cache:', e);
    return empty;
  }
}

/**
 * Clear session local cache on logout:
 * - Always purges legacy unscoped keys.
 * - Clears display cache keys for `uid` so no user data lingers in LocalStorage when logged out.
 * - Preserves `ot_app_u_${uid}_pending_sync_v1` if `uid` still has unsynced offline mutations,
 *   which are strictly isolated to `uid` and never readable by logged-out UI or another account.
 */
export function clearSessionLocalCacheOnLogout(uid?: string | null): void {
  purgeLegacyUnscopedOtKeys();
  if (!uid || typeof window === 'undefined' || !window.localStorage) return;

  try {
    const keys = getUidCacheKeys(uid);
    localStorage.removeItem(keys.settings);
    localStorage.removeItem(keys.cycles);
    localStorage.removeItem(keys.taxes);
    localStorage.removeItem(keys.holidays);
    localStorage.removeItem(keys.increments);
    localStorage.removeItem(keys.resetVersion);
    // Keep keys.pendingSync ONLY if there are unsynced offline writes for this UID
    if (!hasPendingSync(uid)) {
      localStorage.removeItem(keys.pendingSync);
    }
  } catch (e) {
    console.error('Failed to clear session local cache on logout:', e);
  }
}

/**
 * Completely remove all UID-scoped local data (including pending queue) for an explicit Clean Start.
 */
export function clearAllUserLocalData(uid?: string | null): void {
  purgeLegacyUnscopedOtKeys();
  if (!uid || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keys = getUidCacheKeys(uid);
    Object.values(keys).forEach((k) => {
      if (k !== keys.prefix) localStorage.removeItem(k);
    });
  } catch (e) {
    console.error('Failed to clear all user local data:', e);
  }
}
