import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DailyRecord, Holiday, PaySlipAttachment, PayrollSettings, AppView, SalaryIncrementRecord, TaxDeductionConfig } from './types/overtime';
import { 
  calculatePayroll, 
  createCycleRecords, 
  isValidDateString, 
  getEffectiveSalaryForCycle,
  getCycleForDate,
  getLatestCycleAndDate,
  getMonthDiff,
  getCyclePeriodForDate,
  getCyclePeriodForYearMonth,
  isSamePeriod
} from './utils/calculator';
import { DEFAULT_SETTINGS } from './data/initialData';
import { DEFAULT_HOLIDAYS } from './data/holidays';
import { DEFAULT_SALARY_INCREMENTS } from './data/initialSalaryIncrements';
import { Navbar } from './components/Navbar';
import { MainMetricsCards } from './components/MainMetricsCards';
import { OTShareCard } from './components/OTShareCard';
import { TimesheetTable } from './components/TimesheetTable';
import { CalendarView } from './components/CalendarView';
import { RecordModal } from './components/RecordModal';
import { SettingsModal } from './components/SettingsModal';
import { PaySlipModal } from './components/PaySlipModal';
import { BrandEditModal } from './components/BrandEditModal';
import { YearlyDashboard, OverallModule } from './components/YearlyDashboard';
import { useAuth } from './context/AuthContext';
import { useMoneyVisibility } from './context/MoneyVisibilityContext';
import { auth } from './firebase';
import { 
  cleanStartUserCloudData,
  subscribeUserProfile,
  subscribeUserSettings,
  subscribeUserCycles,
  subscribeUserHolidays,
  subscribeUserSalaryIncrements,
  subscribeUserPaySlips,
  saveUserSettings, 
  saveUserCycle, 
  saveUserHolidays, 
  saveBulkHolidays,
  saveUserSalaryIncrements, 
  deleteUserHoliday,
  deleteUserSalaryIncrement,
  saveUserPaySlip,
  deleteUserPaySlip
} from './services/firestoreSync';
import {
  purgeLegacyUnscopedOtKeys,
  loadUserLocalCache,
  saveUserLocalCache,
  clearSessionLocalCacheOnLogout,
  clearAllUserLocalData,
  enqueuePendingSync,
  flushPendingSyncQueue,
  hasPendingSync,
  clearPendingSyncForCycle,
  clearPendingSyncForSettings,
  clearPendingSyncForPaySlip,
  overlayPendingSyncOnSettings,
  overlayPendingSyncOnCycles,
  overlayPendingSyncOnHolidays,
  overlayPendingSyncOnIncrements,
  overlayPendingSyncOnPaySlips,
} from './services/offlineSyncQueue';
import { copyHolidaysToYear } from './utils/holidayManager';
import {
  resolveCurrentCycleRecords,
  buildSettingsFromRemote,
  sanitizeDailyRecord,
  applyUpdatedRecordToCycle,
  deriveAutoWorkStartDate,
} from './utils/recordSyncHelpers';
import { 
  CheckCircle,
  RefreshCw,
  Calendar as CalendarIcon,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  Lock,
  ShieldCheck,
  Smartphone,
  Monitor
} from 'lucide-react';

const DEFAULT_DOCUMENT_TITLE = 'OT PayMaster - ระบบคำนวณโอที';

const isNetworkOrOfflineError = (err: unknown): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err || '').toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('client is offline')
  );
};

export default function App() {
  // Theme state ('light' | 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      console.error(e);
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Purge any legacy unscoped keys immediately on boot
  useEffect(() => {
    purgeLegacyUnscopedOtKeys();
  }, []);

  // User data states strictly start clean/empty — hydrated exclusively for the authenticated UID
  const [holidays, setHolidays] = useState<Holiday[]>(DEFAULT_HOLIDAYS);
  const [settings, setSettings] = useState<PayrollSettings>(() => ({ ...DEFAULT_SETTINGS }));
  const [salaryIncrements, setSalaryIncrements] = useState<SalaryIncrementRecord[]>(DEFAULT_SALARY_INCREMENTS);
  const [allCycleRecords, setAllCycleRecords] = useState<Record<string, DailyRecord[]>>({});
  const [paySlips, setPaySlips] = useState<PaySlipAttachment[]>([]);

  const hasWorkStartDate = Boolean(settings.workStartDate && settings.workStartDate.trim() !== '');

  // Current OT Period based on Asia/Bangkok date and cutoff rule (e.g. 20th - 19th)
  const currentPeriod = useMemo(() => {
    return getCyclePeriodForDate(undefined, settings.cycleStartDay, settings.cycleEndDay);
  }, [settings.cycleStartDay, settings.cycleEndDay]);

  // 3. วันที่ รอบเดือน รอบปี ต่างๆ ให้เริ่มแสดงจากวันที่เริ่มทำงาน และแสดงจนถึงวันที่ รอบเดือน รอบปี ล่าสุดเท่านั้น
  const { startCycle, latestCycle, minCycleOffset, maxCycleOffset } = useMemo(() => {
    const baseYear = 2026;
    const baseMonth = 9; // October (0-indexed: 9 = Oct)

    if (!hasWorkStartDate) {
      return {
        startCycle: { year: 2026, month: 9, cycleKey: '2026-10' },
        latestCycle: { year: currentPeriod.cycleYear, month: currentPeriod.cycleMonth, cycleKey: currentPeriod.cycleKey, latestDate: currentPeriod.periodEnd },
        minCycleOffset: 0,
        maxCycleOffset: 0,
      };
    }

    const start = getCycleForDate(settings.workStartDate!, settings.cycleStartDay, settings.cycleEndDay);
    const recordedKeys = Object.keys(allCycleRecords);
    const latest = getLatestCycleAndDate(settings.cycleStartDay, settings.cycleEndDay, recordedKeys);

    const currentOffset = getMonthDiff(baseYear, baseMonth, currentPeriod.cycleYear, currentPeriod.cycleMonth);
    const minOffset = getMonthDiff(baseYear, baseMonth, start.year, start.month);
    const maxOffset = Math.max(currentOffset, getMonthDiff(baseYear, baseMonth, latest.year, latest.month));

    return {
      startCycle: start,
      latestCycle: latest,
      minCycleOffset: minOffset,
      maxCycleOffset: Math.max(minOffset, maxOffset),
    };
  }, [hasWorkStartDate, settings.workStartDate, settings.cycleStartDay, settings.cycleEndDay, allCycleRecords, currentPeriod]);

  // Cycle navigation offset relative to base (2026-10). Defaults to current period.
  const [cycleOffset, setCycleOffset] = useState<number>(() => {
    const period = getCyclePeriodForDate(undefined, 20, 19);
    return getMonthDiff(2026, 9, period.cycleYear, period.cycleMonth);
  });

  // Auto-clamp cycleOffset between minCycleOffset and maxCycleOffset
  useEffect(() => {
    if (hasWorkStartDate) {
      setCycleOffset((curr) => {
        if (curr < minCycleOffset) return minCycleOffset;
        if (curr > maxCycleOffset) return maxCycleOffset;
        return curr;
      });
    }
  }, [hasWorkStartDate, minCycleOffset, maxCycleOffset]);

  const { targetYear, targetMonth, cycleKey } = useMemo(() => {
    const baseYear = 2026;
    const baseMonth = 9; // October (0-indexed: 9 = Oct)
    const targetDate = new Date(baseYear, baseMonth + cycleOffset, 1);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    return { targetYear: y, targetMonth: m, cycleKey: key };
  }, [cycleOffset]);

  // Selected OT Period for the cycle currently being viewed
  const selectedPeriod = useMemo(() => {
    return getCyclePeriodForYearMonth(targetYear, targetMonth, settings.cycleStartDay, settings.cycleEndDay);
  }, [targetYear, targetMonth, settings.cycleStartDay, settings.cycleEndDay]);

  // Condition to hide/show return button: exact normalized date comparison
  const isCurrentPeriod = useMemo(() => {
    return isSamePeriod(selectedPeriod, currentPeriod);
  }, [selectedPeriod, currentPeriod]);

  // Active cycle records (always show saved cycle records even if workStartDate is not yet set)
  const currentRecords = useMemo(() => {
    return resolveCurrentCycleRecords(
      allCycleRecords,
      cycleKey,
      hasWorkStartDate,
      targetYear,
      targetMonth,
      settings,
      holidays
    );
  }, [hasWorkStartDate, allCycleRecords, cycleKey, targetYear, targetMonth, settings, holidays]);

  // Cycle taxes state starts clean/empty — never read from unscoped LocalStorage
  const [cycleTaxes, setCycleTaxes] = useState<Record<string, number>>({});

  // Views ('timesheet' | 'calendar' | 'dashboard')
  const [currentView, setCurrentView] = useState<AppView>('timesheet');
  const [overallResetSignal, setOverallResetSignal] = useState<number>(0);
  const [overallNavTarget, setOverallNavTarget] = useState<{ module: OverallModule; nonce: number } | null>(null);

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPaySlipModalOpen, setIsPaySlipModalOpen] = useState(false);
  const [isBrandEditModalOpen, setIsBrandEditModalOpen] = useState(false);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [resetStartDateInput, setResetStartDateInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    user,
    loading: authLoading,
    authError,
    setSyncStatus,
    signInWithGoogle,
    signInWithGooglePopup,
    signInWithGoogleRedirect,
    registerBeforeLogout,
  } = useAuth();
  const { formatMoney } = useMoneyVisibility();

  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const isCloudLoadedRef = useRef(false);

  // Per-slice flags prevent echo-writes when hydrating from local cache or receiving Firestore snapshots
  const skipNextSettingsSyncRef = useRef(false);
  const skipNextIncrementsSyncRef = useRef(false);
  const skipNextHolidaysSyncRef = useRef(false);

  const settingsLoadedRef = useRef(false);
  const cyclesLoadedRef = useRef(false);
  const holidaysLoadedRef = useRef(false);
  const incrementsLoadedRef = useRef(false);
  const paySlipsLoadedRef = useRef(false);

  // Strict session isolation refs to defeat async race conditions across logout / account switching
  const authSessionSeqRef = useRef(0);
  const activeUidRef = useRef<string | null>(null);

  // Debounced sync timer & pending-payload refs
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incrementsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holidaysTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingDebounceSettingsRef = useRef<{ uid: string; settings: PayrollSettings } | null>(null);
  const pendingDebounceIncrementsRef = useRef<{ uid: string; records: SalaryIncrementRecord[] } | null>(null);
  const pendingDebounceHolidaysRef = useRef<{ uid: string; holidays: Holiday[] } | null>(null);

  const cancelPendingTimersAndCaptureOffline = useCallback((preserveQueueForUid?: string | null) => {
    if (settingsTimerRef.current) {
      clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = null;
      if (preserveQueueForUid && pendingDebounceSettingsRef.current?.uid === preserveQueueForUid) {
        enqueuePendingSync(preserveQueueForUid, 'SAVE_SETTINGS', {
          settings: pendingDebounceSettingsRef.current.settings,
        });
      }
    }
    pendingDebounceSettingsRef.current = null;

    if (incrementsTimerRef.current) {
      clearTimeout(incrementsTimerRef.current);
      incrementsTimerRef.current = null;
      if (preserveQueueForUid && pendingDebounceIncrementsRef.current?.uid === preserveQueueForUid) {
        enqueuePendingSync(preserveQueueForUid, 'SAVE_SALARY_INCREMENTS', {
          records: pendingDebounceIncrementsRef.current.records,
        });
      }
    }
    pendingDebounceIncrementsRef.current = null;

    if (holidaysTimerRef.current) {
      clearTimeout(holidaysTimerRef.current);
      holidaysTimerRef.current = null;
      if (preserveQueueForUid && pendingDebounceHolidaysRef.current?.uid === preserveQueueForUid) {
        enqueuePendingSync(preserveQueueForUid, 'SAVE_HOLIDAYS', {
          holidays: pendingDebounceHolidaysRef.current.holidays,
        });
      }
    }
    pendingDebounceHolidaysRef.current = null;
  }, []);

  const resetAllUserState = useCallback(() => {
    skipNextSettingsSyncRef.current = false;
    skipNextIncrementsSyncRef.current = false;
    skipNextHolidaysSyncRef.current = false;

    settingsLoadedRef.current = false;
    cyclesLoadedRef.current = false;
    holidaysLoadedRef.current = false;
    incrementsLoadedRef.current = false;
    paySlipsLoadedRef.current = false;

    isCloudLoadedRef.current = false;
    setIsCloudLoaded(false);

    setHolidays(DEFAULT_HOLIDAYS);
    setSettings({ ...DEFAULT_SETTINGS });
    setSalaryIncrements(DEFAULT_SALARY_INCREMENTS);
    setAllCycleRecords({});
    setCycleTaxes({});
    setPaySlips([]);

    setSelectedRecord(null);
    setIsRecordModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsPaySlipModalOpen(false);
    setIsBrandEditModalOpen(false);
    setIsResetConfirmModalOpen(false);
    setResetStartDateInput('');
    setCurrentView('timesheet');
    setOverallNavTarget(null);

    const period = getCyclePeriodForDate(undefined, 20, 19);
    setCycleOffset(getMonthDiff(2026, 9, period.cycleYear, period.cycleMonth));
    document.title = DEFAULT_DOCUMENT_TITLE;
  }, []);

  // Synchronously wipe UI state, timers, and readable LocalStorage immediately when logout() is invoked
  useEffect(() => {
    return registerBeforeLogout((loggingOutUid) => {
      const uid = loggingOutUid || activeUidRef.current;
      cancelPendingTimersAndCaptureOffline(uid);
      authSessionSeqRef.current += 1;
      activeUidRef.current = null;
      resetAllUserState();
      clearSessionLocalCacheOnLogout(uid);
    });
  }, [registerBeforeLogout, cancelPendingTimersAndCaptureOffline, resetAllUserState]);

  // Setup Real-time Listeners (onSnapshot) with Strict UID Isolation & Race-Condition Protection
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      const prevUid = activeUidRef.current;
      cancelPendingTimersAndCaptureOffline(prevUid);
      authSessionSeqRef.current += 1;
      activeUidRef.current = null;
      resetAllUserState();
      clearSessionLocalCacheOnLogout(prevUid);
      setSyncStatus('local');
      return;
    }

    const sessionUid = user.uid;
    const prevUid = activeUidRef.current;

    // If switching directly from Account A to Account B, wipe Account A completely first
    if (prevUid && prevUid !== sessionUid) {
      cancelPendingTimersAndCaptureOffline(prevUid);
      clearSessionLocalCacheOnLogout(prevUid);
    } else {
      cancelPendingTimersAndCaptureOffline(null);
    }

    // Always start from clean empty state before loading the target UID's data
    resetAllUserState();

    const sessionSeq = ++authSessionSeqRef.current;
    activeUidRef.current = sessionUid;

    let isSubscribed = true;
    const isSessionValid = () =>
      isSubscribed &&
      authSessionSeqRef.current === sessionSeq &&
      auth.currentUser?.uid === sessionUid;

    const initialOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setSyncStatus(initialOffline ? 'offline' : 'saving');

    // Hydrate immediately from UID-scoped local cache (if available for THIS UID)
    const cached = loadUserLocalCache(sessionUid);
    if (cached.hasCachedData) {
      skipNextSettingsSyncRef.current = true;
      skipNextHolidaysSyncRef.current = true;
      skipNextIncrementsSyncRef.current = true;
      setSettings(cached.settings);
      setAllCycleRecords(cached.allCycleRecords);
      setCycleTaxes(cached.cycleTaxes);
      setHolidays(cached.holidays);
      setSalaryIncrements(cached.salaryIncrements);
      setPaySlips(cached.paySlips || []);
    }

    const flushAndSyncStatus = async () => {
      if (!isSessionValid()) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setSyncStatus('offline');
        return;
      }
      if (hasPendingSync(sessionUid)) {
        setSyncStatus('saving');
        const result = await flushPendingSyncQueue(sessionUid, () =>
          isSessionValid() ? sessionUid : null
        );
        if (!isSessionValid()) return;
        setSyncStatus(result.remaining > 0 ? 'offline' : 'synced');
      } else {
        setSyncStatus('synced');
      }
    };

    const checkAllLoaded = () => {
      if (
        settingsLoadedRef.current &&
        cyclesLoadedRef.current &&
        holidaysLoadedRef.current &&
        incrementsLoadedRef.current &&
        paySlipsLoadedRef.current
      ) {
        if (isSessionValid()) {
          isCloudLoadedRef.current = true;
          setIsCloudLoaded(true);
          void flushAndSyncStatus();
        }
      }
    };

    // Safety timeout: ensure UI is not blocked indefinitely if offline
    const fallbackTimer = setTimeout(() => {
      if (isSessionValid() && !isCloudLoadedRef.current) {
        if (!settingsLoadedRef.current) skipNextSettingsSyncRef.current = true;
        if (!holidaysLoadedRef.current) skipNextHolidaysSyncRef.current = true;
        if (!incrementsLoadedRef.current) skipNextIncrementsSyncRef.current = true;
        isCloudLoadedRef.current = true;
        setIsCloudLoaded(true);
        setSyncStatus(
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'offline'
            : hasPendingSync(sessionUid)
            ? 'offline'
            : 'synced'
        );
      }
    }, 2500);

    // Track cloud resetVersion during this session
    let seenResetVersion: string | null = cached.appliedResetVersion;

    // 1. Profile listener (Cloud-Driven Local Reset scoped strictly to sessionUid)
    const unsubProfile = subscribeUserProfile(
      sessionUid,
      (resetVersion) => {
        if (!isSessionValid() || !resetVersion) return;
        if (seenResetVersion && seenResetVersion !== resetVersion) {
          cancelPendingTimersAndCaptureOffline(null);
          clearAllUserLocalData(sessionUid);
          saveUserLocalCache(sessionUid, { appliedResetVersion: resetVersion });
          resetAllUserState();
          isCloudLoadedRef.current = true;
          setIsCloudLoaded(true);
        } else if (!seenResetVersion) {
          saveUserLocalCache(sessionUid, { appliedResetVersion: resetVersion });
        }
        seenResetVersion = resetVersion;
      },
      (err) => console.error('Profile listener error:', err)
    );

    // 2. Settings Real-time listener (preserves cached/default workStartDate if remote is empty)
    const unsubSettings = subscribeUserSettings(
      sessionUid,
      (remoteSettings, remoteUpdatedAt) => {
        if (!isSessionValid()) return;
        settingsLoadedRef.current = true;
        const latestCached = loadUserLocalCache(sessionUid);
        const baseSettings = buildSettingsFromRemote(
          remoteSettings,
          latestCached.hasCachedData,
          latestCached.settings
        );
        const resolved = overlayPendingSyncOnSettings(sessionUid, baseSettings, remoteUpdatedAt);
        skipNextSettingsSyncRef.current = true;
        setSettings(resolved);
        saveUserLocalCache(sessionUid, { settings: resolved });
        checkAllLoaded();
      },
      (err) => {
        console.error('Settings listener error:', err);
        if (!isSessionValid()) return;
        settingsLoadedRef.current = true;
        checkAllLoaded();
      }
    );

    // 3. Cycles & Taxes Real-time listener (passes remoteUpdatedAtMap so stale pending items never overwrite newer cloud data)
    const unsubCycles = subscribeUserCycles(
      sessionUid,
      (remoteCycles, remoteTaxes, remoteUpdatedAtMap) => {
        if (!isSessionValid()) return;
        cyclesLoadedRef.current = true;
        const overlaid = overlayPendingSyncOnCycles(
          sessionUid,
          remoteCycles || {},
          remoteTaxes || {},
          remoteUpdatedAtMap || {}
        );
        setAllCycleRecords(overlaid.cycles);
        setCycleTaxes(overlaid.taxes);
        saveUserLocalCache(sessionUid, {
          allCycleRecords: overlaid.cycles,
          cycleTaxes: overlaid.taxes,
        });
        checkAllLoaded();
      },
      (err) => {
        console.error('Cycles listener error:', err);
        if (!isSessionValid()) return;
        cyclesLoadedRef.current = true;
        checkAllLoaded();
      }
    );

    // 4. Holidays Real-time listener (replaces with [] if account has no holidays!)
    const unsubHolidays = subscribeUserHolidays(
      sessionUid,
      (remoteHolidays) => {
        if (!isSessionValid()) return;
        holidaysLoadedRef.current = true;
        const resolved = overlayPendingSyncOnHolidays(sessionUid, remoteHolidays || []);
        skipNextHolidaysSyncRef.current = true;
        setHolidays(resolved);
        saveUserLocalCache(sessionUid, { holidays: resolved });
        checkAllLoaded();
      },
      (err) => {
        console.error('Holidays listener error:', err);
        if (!isSessionValid()) return;
        holidaysLoadedRef.current = true;
        checkAllLoaded();
      }
    );

    // 5. Salary Increments Real-time listener (replaces with [] if account has no records!)
    const unsubIncrements = subscribeUserSalaryIncrements(
      sessionUid,
      (remoteIncrements) => {
        if (!isSessionValid()) return;
        incrementsLoadedRef.current = true;
        const resolved = overlayPendingSyncOnIncrements(sessionUid, remoteIncrements || []);
        skipNextIncrementsSyncRef.current = true;
        setSalaryIncrements(resolved);
        saveUserLocalCache(sessionUid, { salaryIncrements: resolved });
        checkAllLoaded();
      },
      (err) => {
        console.error('Salary increments listener error:', err);
        if (!isSessionValid()) return;
        incrementsLoadedRef.current = true;
        checkAllLoaded();
      }
    );

    // 6. Pay Slip Attachments Real-time listener
    const unsubPaySlips = subscribeUserPaySlips(
      sessionUid,
      (remoteSlips) => {
        if (!isSessionValid()) return;
        paySlipsLoadedRef.current = true;
        const resolved = overlayPendingSyncOnPaySlips(sessionUid, remoteSlips || []);
        setPaySlips(resolved);
        saveUserLocalCache(sessionUid, { paySlips: resolved });
        checkAllLoaded();
      },
      (err) => {
        console.error('PaySlips listener error:', err);
        if (!isSessionValid()) return;
        paySlipsLoadedRef.current = true;
        checkAllLoaded();
      }
    );

    const handleOnline = () => {
      if (!isSessionValid()) return;
      void flushAndSyncStatus();
    };
    const handleOffline = () => {
      if (!isSessionValid()) return;
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isSubscribed = false;
      clearTimeout(fallbackTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubProfile();
      unsubSettings();
      unsubCycles();
      unsubHolidays();
      unsubIncrements();
      unsubPaySlips();
    };
  }, [user, authLoading, cancelPendingTimersAndCaptureOffline, resetAllUserState, setSyncStatus]);

  // Sync settings to Firestore (Protected: Only runs after initial cloud load & verified active session)
  useEffect(() => {
    if (!user || !isCloudLoaded) return;
    if (skipNextSettingsSyncRef.current) {
      skipNextSettingsSyncRef.current = false;
      return;
    }

    const sessionUid = user.uid;
    const sessionSeq = authSessionSeqRef.current;
    if (activeUidRef.current !== sessionUid || auth.currentUser?.uid !== sessionUid) return;

    saveUserLocalCache(sessionUid, { settings });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings });
      setSyncStatus('offline');
      return;
    }

    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    pendingDebounceSettingsRef.current = { uid: sessionUid, settings };
    setSyncStatus('saving');

    settingsTimerRef.current = setTimeout(async () => {
      settingsTimerRef.current = null;
      pendingDebounceSettingsRef.current = null;
      if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings });
        setSyncStatus('offline');
        return;
      }
      try {
        const writeStartMs = Date.now();
        await saveUserSettings(sessionUid, settings);
        clearPendingSyncForSettings(sessionUid, writeStartMs);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus(hasPendingSync(sessionUid) ? 'offline' : 'synced');
        }
      } catch (e) {
        console.error('Failed to sync settings:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings });
          setSyncStatus('offline');
        } else {
          setSyncStatus('error');
        }
      }
    }, 600);

    return () => {
      if (settingsTimerRef.current) {
        clearTimeout(settingsTimerRef.current);
        settingsTimerRef.current = null;
      }
    };
  }, [settings, user, isCloudLoaded, setSyncStatus]);

  // Sync salary increments to Firestore (Protected)
  useEffect(() => {
    if (!user || !isCloudLoaded) return;
    if (skipNextIncrementsSyncRef.current) {
      skipNextIncrementsSyncRef.current = false;
      return;
    }

    const sessionUid = user.uid;
    const sessionSeq = authSessionSeqRef.current;
    if (activeUidRef.current !== sessionUid || auth.currentUser?.uid !== sessionUid) return;

    saveUserLocalCache(sessionUid, { salaryIncrements });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueuePendingSync(sessionUid, 'SAVE_SALARY_INCREMENTS', { records: salaryIncrements });
      setSyncStatus('offline');
      return;
    }

    if (incrementsTimerRef.current) clearTimeout(incrementsTimerRef.current);
    pendingDebounceIncrementsRef.current = { uid: sessionUid, records: salaryIncrements };
    setSyncStatus('saving');

    incrementsTimerRef.current = setTimeout(async () => {
      incrementsTimerRef.current = null;
      pendingDebounceIncrementsRef.current = null;
      if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_SALARY_INCREMENTS', { records: salaryIncrements });
        setSyncStatus('offline');
        return;
      }
      try {
        await saveUserSalaryIncrements(sessionUid, salaryIncrements);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus(hasPendingSync(sessionUid) ? 'offline' : 'synced');
        }
      } catch (e) {
        console.error('Failed to sync salary increments:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_SALARY_INCREMENTS', { records: salaryIncrements });
          setSyncStatus('offline');
        } else {
          setSyncStatus('error');
        }
      }
    }, 600);

    return () => {
      if (incrementsTimerRef.current) {
        clearTimeout(incrementsTimerRef.current);
        incrementsTimerRef.current = null;
      }
    };
  }, [salaryIncrements, user, isCloudLoaded, setSyncStatus]);

  // Sync holidays to Firestore (Protected)
  useEffect(() => {
    if (!user || !isCloudLoaded) return;
    if (skipNextHolidaysSyncRef.current) {
      skipNextHolidaysSyncRef.current = false;
      return;
    }

    const sessionUid = user.uid;
    const sessionSeq = authSessionSeqRef.current;
    if (activeUidRef.current !== sessionUid || auth.currentUser?.uid !== sessionUid) return;

    saveUserLocalCache(sessionUid, { holidays });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (holidays.length > 0) {
        enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays });
      }
      setSyncStatus('offline');
      return;
    }

    if (holidaysTimerRef.current) clearTimeout(holidaysTimerRef.current);
    pendingDebounceHolidaysRef.current = { uid: sessionUid, holidays };
    setSyncStatus('saving');

    holidaysTimerRef.current = setTimeout(async () => {
      holidaysTimerRef.current = null;
      pendingDebounceHolidaysRef.current = null;
      if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (holidays.length > 0) {
          enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays });
        }
        setSyncStatus('offline');
        return;
      }
      try {
        await saveUserHolidays(sessionUid, holidays);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus(hasPendingSync(sessionUid) ? 'offline' : 'synced');
        }
      } catch (e) {
        console.error('Failed to sync holidays:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          if (holidays.length > 0) {
            enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays });
          }
          setSyncStatus('offline');
        } else {
          setSyncStatus('error');
        }
      }
    }, 600);

    return () => {
      if (holidaysTimerRef.current) {
        clearTimeout(holidaysTimerRef.current);
        holidaysTimerRef.current = null;
      }
    };
  }, [holidays, user, isCloudLoaded, setSyncStatus]);

  const handleUpdateSalaryIncrements = async (nextRecords: SalaryIncrementRecord[]) => {
    const prevIds = new Set(salaryIncrements.map((r) => r.id));
    const nextIds = new Set(nextRecords.map((r) => r.id));
    const deletedIds = Array.from(prevIds).filter((id) => !nextIds.has(id));

    setSalaryIncrements(nextRecords);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { salaryIncrements: nextRecords });

      if (deletedIds.length > 0) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          deletedIds.forEach((id) =>
            enqueuePendingSync(sessionUid, 'DELETE_SALARY_INCREMENT', { recordId: id })
          );
          setSyncStatus('offline');
          return;
        }
        for (const id of deletedIds) {
          if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
            return;
          }
          try {
            await deleteUserSalaryIncrement(sessionUid, id);
          } catch (e) {
            console.error('Failed to delete salary increment on cloud:', e);
            if (authSessionSeqRef.current === sessionSeq && isNetworkOrOfflineError(e)) {
              enqueuePendingSync(sessionUid, 'DELETE_SALARY_INCREMENT', { recordId: id });
              setSyncStatus('offline');
            }
          }
        }
      }
    }
  };

  const handleUpdateCycleTax = async (cKey: string, val: number) => {
    const nextTaxes = {
      ...cycleTaxes,
      [cKey]: val,
    };
    setCycleTaxes(nextTaxes);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      const recordsForCycle = allCycleRecords[cKey] || currentRecords;
      saveUserLocalCache(sessionUid, { cycleTaxes: nextTaxes });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
          cycleKey: cKey,
          records: recordsForCycle,
          taxPaid: val,
        });
        setSyncStatus('offline');
        showToast('บันทึกภาษีแบบออฟไลน์แล้ว (รอซิงค์เมื่อออนไลน์)');
        return;
      }

      setSyncStatus('saving');
      try {
        const writeStartMs = Date.now();
        await saveUserCycle(sessionUid, cKey, recordsForCycle, val);
        clearPendingSyncForCycle(sessionUid, cKey, writeStartMs);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast('อัปเดตภาษีสำเร็จ (บันทึกบนคลาวด์)');
        }
      } catch (e) {
        console.error(e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
            cycleKey: cKey,
            records: recordsForCycle,
            taxPaid: val,
          });
          setSyncStatus('offline');
          showToast('บันทึกภาษีแบบออฟไลน์แล้ว (รอซิงค์เมื่อออนไลน์)');
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการบันทึกภาษีบนคลาวด์');
        }
      }
    }
  };

  // Update year-by-year vacation quota
  const handleUpdateYearlyVacationQuota = async (
    year: number,
    quotaData: { baseQuota: number; carriedOver?: number; note?: string }
  ) => {
    const existing = settings.yearlyVacationQuotas || DEFAULT_SETTINGS.yearlyVacationQuotas || {};
    const nextSettings: PayrollSettings = {
      ...settings,
      yearlyVacationQuotas: {
        ...existing,
        [year]: {
          baseQuota: Number(quotaData.baseQuota) || 0,
          carriedOver: Number(quotaData.carriedOver) || 0,
          note: quotaData.note || '',
        },
      },
    };
    skipNextSettingsSyncRef.current = true;
    setSettings(nextSettings);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { settings: nextSettings });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
        setSyncStatus('offline');
        showToast(`อัปเดตสิทธิ์วันลาพักร้อนปี ${year} แบบออฟไลน์แล้ว`);
        return;
      }

      setSyncStatus('saving');
      try {
        await saveUserSettings(sessionUid, nextSettings);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast(`อัปเดตสิทธิ์วันลาพักร้อนปี ${year} เรียบร้อยแล้ว (บันทึกบนคลาวด์แล้ว)`);
        }
      } catch (e) {
        console.error('Failed to save vacation quota to cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
          setSyncStatus('offline');
          showToast(`อัปเดตสิทธิ์วันลาพักร้อนปี ${year} แบบออฟไลน์แล้ว`);
        } else {
          setSyncStatus('error');
          showToast(`เกิดข้อผิดพลาดในการบันทึกวันลาพักร้อนบนคลาวด์`);
        }
      }
    } else {
      showToast(`อัปเดตสิทธิ์วันลาพักร้อนปี ${year} เรียบร้อยแล้ว`);
    }
  };

  const handleBatchUpdateVacationQuotas = async (
    newQuotas: Record<number, { baseQuota: number; carriedOver?: number; note?: string }>
  ) => {
    const nextSettings: PayrollSettings = {
      ...settings,
      yearlyVacationQuotas: newQuotas,
    };
    skipNextSettingsSyncRef.current = true;
    setSettings(nextSettings);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { settings: nextSettings });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
        setSyncStatus('offline');
        showToast('อัปเดตตารางสิทธิ์วันลาพักร้อนรายปีแบบออฟไลน์แล้ว');
        return;
      }

      setSyncStatus('saving');
      try {
        await saveUserSettings(sessionUid, nextSettings);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast('อัปเดตตารางสิทธิ์วันลาพักร้อนรายปีสำเร็จ (บันทึกบนคลาวด์แล้ว)');
        }
      } catch (e) {
        console.error('Failed to batch save vacation quotas:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
          setSyncStatus('offline');
          showToast('อัปเดตตารางสิทธิ์วันลาพักร้อนรายปีแบบออฟไลน์แล้ว');
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการบันทึกตารางสิทธิ์วันลาพักร้อนบนคลาวด์');
        }
      }
    } else {
      showToast('อัปเดตตารางสิทธิ์วันลาพักร้อนรายปีสำเร็จ');
    }
  };

  // Update year-by-year annual tax deduction plan
  const handleUpdateYearlyTaxDeductions = async (
    year: number,
    config: TaxDeductionConfig,
    silent = false
  ) => {
    const existing = settings.yearlyTaxDeductions || {};
    const nextSettings: PayrollSettings = {
      ...settings,
      yearlyTaxDeductions: {
        ...existing,
        [year]: config,
      },
    };
    skipNextSettingsSyncRef.current = true;
    setSettings(nextSettings);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { settings: nextSettings });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
        setSyncStatus('offline');
        if (!silent) showToast(`บันทึกแผนลดหย่อนภาษีปี ${year} แบบออฟไลน์แล้ว`);
        return;
      }

      setSyncStatus('saving');
      try {
        await saveUserSettings(sessionUid, nextSettings);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          if (!silent) showToast(`บันทึกแผนลดหย่อนภาษีปี ${year} เรียบร้อยแล้ว (ซิงค์คลาวด์แล้ว)`);
        }
      } catch (e) {
        console.error('Failed to save yearly tax deductions to cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
          setSyncStatus('offline');
          if (!silent) showToast(`บันทึกแผนลดหย่อนภาษีปี ${year} แบบออฟไลน์แล้ว`);
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการบันทึกแผนลดหย่อนภาษีบนคลาวด์');
        }
      }
    } else if (!silent) {
      showToast(`บันทึกแผนลดหย่อนภาษีปี ${year} เรียบร้อยแล้ว`);
    }
  };

  // Sync document title with customized app name (resets to default when logged out)
  useEffect(() => {
    if (user && settings.appName) {
      document.title = `${settings.appName} - ระบบคำนวณโอที`;
    } else {
      document.title = DEFAULT_DOCUMENT_TITLE;
    }
  }, [user, settings.appName]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 3: รวมค่าภาษีของรอบปัจจุบันเข้าไปคำนวณ พร้อมดึงฐานเงินเดือนอัตโนมัติตามช่วงเดือน
  const currentCycleTax = cycleTaxes[cycleKey] ?? 0;

  // คำนวณฐานเงินเดือนอัตโนมัติตามช่วงเดือนที่มีผลของรอบปัจจุบัน
  const activeBaseSalary = useMemo(() => {
    return getEffectiveSalaryForCycle(targetYear, targetMonth, salaryIncrements, settings.baseSalary);
  }, [targetYear, targetMonth, salaryIncrements, settings.baseSalary]);

  // Settings สำหรับรอบปัจจุบัน โดยปรับฐานเงินเดือนตามช่วงเดือนโดยอัตโนมัติ
  const currentCycleSettings = useMemo(() => {
    return {
      ...settings,
      baseSalary: activeBaseSalary,
      taxPaid: currentCycleTax,
    };
  }, [settings, activeBaseSalary, currentCycleTax]);

  const summary = useMemo(() => {
    return calculatePayroll(currentRecords, currentCycleSettings);
  }, [currentRecords, currentCycleSettings]);

  // 2: เปลี่ยนปี พ.ศ. เป็นปี ค.ศ.
  const cycleLabel = useMemo(() => {
    if (!hasWorkStartDate) return '';
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const currM = targetMonth;
    const currY = targetYear; // ค.ศ.
    let prevM = currM - 1;
    let prevY = currY;
    if (prevM < 0) {
      prevM = 11;
      prevY -= 1;
    }
    return `${settings.cycleStartDay} ${thaiMonths[prevM]} - ${settings.cycleEndDay} ${thaiMonths[currM]} ${currY}`;
  }, [hasWorkStartDate, targetMonth, targetYear, settings.cycleStartDay, settings.cycleEndDay]);

  // Update a single record (done through calendar)
  const handleUpdateRecord = async (updated: DailyRecord) => {
    const cleanUpdated = sanitizeDailyRecord(updated);
    const existing = allCycleRecords[cycleKey];
    const baseList =
      existing && existing.length > 0
        ? existing
        : currentRecords.length > 0
          ? currentRecords
          : createCycleRecords(targetYear, targetMonth, settings, holidays);

    const finalRecords = applyUpdatedRecordToCycle(baseList, cleanUpdated);
    const nextCycles = {
      ...allCycleRecords,
      [cycleKey]: finalRecords,
    };

    setAllCycleRecords((prev) => {
      const prevList = prev[cycleKey] && prev[cycleKey].length > 0 ? prev[cycleKey] : baseList;
      return {
        ...prev,
        [cycleKey]: applyUpdatedRecordToCycle(prevList, cleanUpdated),
      };
    });

    // Auto-set workStartDate if blank so TimesheetTable/CalendarView/Navbar never hide saved records
    let nextSettingsToPersist: PayrollSettings | null = null;
    if (!settings.workStartDate || settings.workStartDate.trim() === '') {
      const autoStartDate = deriveAutoWorkStartDate(cleanUpdated.date, targetYear);
      nextSettingsToPersist = {
        ...settings,
        workStartDate: autoStartDate,
      };
      skipNextSettingsSyncRef.current = true;
      setSettings(nextSettingsToPersist);
    }

    const currentTax = cycleTaxes[cycleKey] ?? 0;

    if (user) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;

      saveUserLocalCache(sessionUid, {
        allCycleRecords: nextCycles,
        ...(nextSettingsToPersist ? { settings: nextSettingsToPersist } : {}),
      });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
          cycleKey,
          records: finalRecords,
          taxPaid: currentTax,
        });
        if (nextSettingsToPersist) {
          enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettingsToPersist });
        }
        setSyncStatus('offline');
        showToast(`บันทึกข้อมูลวันที่ ${cleanUpdated.dayNumber} แบบออฟไลน์แล้ว (รอซิงค์เมื่อออนไลน์)`);
        return;
      }

      setSyncStatus('saving');
      try {
        const writeStartMs = Date.now();
        await saveUserCycle(sessionUid, cycleKey, finalRecords, currentTax);
        clearPendingSyncForCycle(sessionUid, cycleKey, writeStartMs);
        if (nextSettingsToPersist) {
          await saveUserSettings(sessionUid, nextSettingsToPersist);
          clearPendingSyncForSettings(sessionUid, writeStartMs);
        }
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast(`บันทึกข้อมูลวันที่ ${cleanUpdated.dayNumber} สำเร็จ (บันทึกบนคลาวด์แล้ว)`);
        }
      } catch (e: any) {
        console.error('Failed to save record to cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
            cycleKey,
            records: finalRecords,
            taxPaid: currentTax,
          });
          if (nextSettingsToPersist) {
            enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettingsToPersist });
          }
          setSyncStatus('offline');
          showToast(`บันทึกข้อมูลวันที่ ${cleanUpdated.dayNumber} แบบออฟไลน์แล้ว (รอซิงค์เมื่อออนไลน์)`);
        } else {
          setSyncStatus('error');
          showToast(`บันทึกบนคลาวด์ไม่สำเร็จ: ${e?.message || 'โปรดตรวจสอบการเชื่อมต่อ'}`);
        }
      }
    } else {
      showToast(`บันทึกข้อมูลวันที่ ${cleanUpdated.dayNumber} สำเร็จ`);
    }
  };

  // Re-apply shift pattern (2wk Day/Night & Sat A/B)
  const handleReapplyShiftPattern = async () => {
    const fresh = createCycleRecords(targetYear, targetMonth, settings, holidays);
    const existingMap = new Map<string, DailyRecord>();
    currentRecords.forEach((r) => existingMap.set(r.date, r));

    const merged = fresh.map((r) => {
      const old = existingMap.get(r.date);
      if (old) {
        return {
          ...r,
          ot1_0: old.ot1_0,
          ot1_5: old.ot1_5,
          ot2_0: old.ot2_0,
          ot3_0: old.ot3_0,
          shiftType: old.shiftType !== 'NORMAL' ? old.shiftType : r.shiftType,
          note: old.note || r.note,
        };
      }
      return r;
    });

    const nextCycles = {
      ...allCycleRecords,
      [cycleKey]: merged,
    };
    setAllCycleRecords(nextCycles);

    const currentTax = cycleTaxes[cycleKey] ?? 0;

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { allCycleRecords: nextCycles });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
          cycleKey,
          records: merged,
          taxPaid: currentTax,
        });
        setSyncStatus('offline');
        showToast(`จัดตารางกะ ${settings.shiftGroup} แบบออฟไลน์แล้ว`);
        return;
      }

      setSyncStatus('saving');
      try {
        const writeStartMs = Date.now();
        await saveUserCycle(sessionUid, cycleKey, merged, currentTax);
        clearPendingSyncForCycle(sessionUid, cycleKey, writeStartMs);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast(`จัดตารางกะ ${settings.shiftGroup} สำเร็จ (บันทึกบนคลาวด์แล้ว)`);
        }
      } catch (e) {
        console.error('Failed to save shift pattern to cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
            cycleKey,
            records: merged,
            taxPaid: cycleTaxes[cycleKey],
          });
          setSyncStatus('offline');
          showToast(`จัดตารางกะ ${settings.shiftGroup} แบบออฟไลน์แล้ว`);
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการบันทึกตารางกะบนคลาวด์');
        }
      }
    } else {
      showToast(`จัดตารางกะ ${settings.shiftGroup} สำเร็จ`);
    }
  };

  // Holidays management
  const handleAddHoliday = async (newH: Omit<Holiday, 'id'>) => {
    const id = `hol-${Date.now()}`;
    const created: Holiday = { ...newH, id };
    const nextHolidays = [...holidays, created];
    skipNextHolidaysSyncRef.current = true;
    setHolidays(nextHolidays);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { holidays: nextHolidays });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays: nextHolidays });
        setSyncStatus('offline');
        showToast(`เพิ่มวันหยุด "${created.name}" แบบออฟไลน์แล้ว`);
        return;
      }

      setSyncStatus('saving');
      try {
        await saveUserHolidays(sessionUid, nextHolidays);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast(`เพิ่มวันหยุด "${created.name}" สำเร็จ (บันทึกบนคลาวด์แล้ว)`);
        }
      } catch (e) {
        console.error('Failed to save holiday to cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays: nextHolidays });
          setSyncStatus('offline');
          showToast(`เพิ่มวันหยุด "${created.name}" แบบออฟไลน์แล้ว`);
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการบันทึกวันหยุดบนคลาวด์');
        }
      }
    } else {
      showToast(`เพิ่มวันหยุด "${created.name}" สำเร็จ`);
    }
  };

  const handleUpdateHoliday = async (updatedH: Holiday) => {
    const nextHolidays = holidays.map((h) => (h.id === updatedH.id ? updatedH : h));
    skipNextHolidaysSyncRef.current = true;
    setHolidays(nextHolidays);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { holidays: nextHolidays });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays: nextHolidays });
        setSyncStatus('offline');
        showToast(`แก้ไขวันหยุด "${updatedH.name}" แบบออฟไลน์แล้ว`);
        return;
      }

      setSyncStatus('saving');
      try {
        await saveUserHolidays(sessionUid, nextHolidays);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast(`แก้ไขวันหยุด "${updatedH.name}" สำเร็จ (บันทึกบนคลาวด์แล้ว)`);
        }
      } catch (e) {
        console.error('Failed to update holiday on cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays: nextHolidays });
          setSyncStatus('offline');
          showToast(`แก้ไขวันหยุด "${updatedH.name}" แบบออฟไลน์แล้ว`);
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการแก้ไขวันหยุดบนคลาวด์');
        }
      }
    } else {
      showToast(`แก้ไขวันหยุด "${updatedH.name}" สำเร็จ`);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    const nextHolidays = holidays.filter((h) => h.id !== id);
    skipNextHolidaysSyncRef.current = true;
    setHolidays(nextHolidays);

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { holidays: nextHolidays });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'DELETE_HOLIDAY', { holidayId: id });
        setSyncStatus('offline');
        showToast('ลบวันหยุดแบบออฟไลน์แล้ว');
        return;
      }

      setSyncStatus('saving');
      try {
        await deleteUserHoliday(sessionUid, id);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast('ลบวันหยุดสำเร็จ (บันทึกบนคลาวด์แล้ว)');
        }
      } catch (e) {
        console.error('Failed to delete holiday on cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'DELETE_HOLIDAY', { holidayId: id });
          setSyncStatus('offline');
          showToast('ลบวันหยุดแบบออฟไลน์แล้ว');
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการลบวันหยุดบนคลาวด์');
        }
      }
    } else {
      showToast('ลบวันหยุดสำเร็จ');
    }
  };

  // Copy holidays from previous year template
  const handleCopyHolidaysFromYear = async (sourceYear: number, targetYear: number) => {
    try {
      const { newHolidays, copiedCount } = copyHolidaysToYear(holidays, sourceYear, targetYear);
      const nextHolidays = [...holidays, ...newHolidays];
      skipNextHolidaysSyncRef.current = true;
      setHolidays(nextHolidays);

      if (user && isCloudLoaded) {
        const sessionUid = user.uid;
        const sessionSeq = authSessionSeqRef.current;
        saveUserLocalCache(sessionUid, { holidays: nextHolidays });

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays: nextHolidays });
          setSyncStatus('offline');
          showToast(`สร้างวันหยุดปี ${targetYear} แบบออฟไลน์แล้ว (${copiedCount} รายการ)`);
          return;
        }

        setSyncStatus('saving');
        try {
          await saveBulkHolidays(sessionUid, newHolidays);
          if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
            setSyncStatus('synced');
            showToast(`สร้างวันหยุดปี ${targetYear} จากปี ${sourceYear} สำเร็จ (${copiedCount} รายการ บันทึกบนคลาวด์แล้ว)`);
          }
        } catch (e) {
          console.error('Failed to save bulk holidays to cloud:', e);
          if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
            return;
          }
          if (isNetworkOrOfflineError(e)) {
            enqueuePendingSync(sessionUid, 'SAVE_HOLIDAYS', { holidays: nextHolidays });
            setSyncStatus('offline');
            showToast(`สร้างวันหยุดปี ${targetYear} แบบออฟไลน์แล้ว (${copiedCount} รายการ)`);
          } else {
            setSyncStatus('error');
            showToast('เกิดข้อผิดพลาดในการบันทึกวันหยุดบนคลาวด์');
          }
        }
      } else {
        showToast(`สร้างวันหยุดปี ${targetYear} จากปี ${sourceYear} สำเร็จ (${copiedCount} รายการ)`);
      }
    } catch (err: any) {
      showToast(err.message || 'ไม่สามารถคัดลอกวันหยุดได้');
    }
  };

  // Apply holidays to current cycle
  const handleApplyHolidaysToCurrentCycle = async () => {
    const holidayMap = new Map<string, Holiday>();
    holidays.forEach((h) => holidayMap.set(h.date, h));

    const existing = allCycleRecords[cycleKey] || currentRecords;
    const updatedList = existing.map((r) => {
      const hol = holidayMap.get(r.date);
      if (hol) {
        return {
          ...r,
          shiftType: 'H' as const,
          holidayName: hol.name,
          note: r.note ? `${r.note} (${hol.name})` : hol.name,
        };
      }
      return r;
    });
    const nextCycles = {
      ...allCycleRecords,
      [cycleKey]: updatedList,
    };
    setAllCycleRecords(nextCycles);

    const currentTax = cycleTaxes[cycleKey] ?? 0;

    if (user && isCloudLoaded) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { allCycleRecords: nextCycles });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
          cycleKey,
          records: updatedList,
          taxPaid: currentTax,
        });
        setSyncStatus('offline');
        showToast('นำวันหยุดไปใช้กับรอบนี้แบบออฟไลน์แล้ว');
        return;
      }

      setSyncStatus('saving');
      try {
        const writeStartMs = Date.now();
        await saveUserCycle(sessionUid, cycleKey, updatedList, currentTax);
        clearPendingSyncForCycle(sessionUid, cycleKey, writeStartMs);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus('synced');
          showToast('นำวันหยุดไปใช้กับรอบนี้สำเร็จ (บันทึกบนคลาวด์แล้ว)');
        }
      } catch (e) {
        console.error('Failed to apply holidays to cloud cycle:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_CYCLE', {
            cycleKey,
            records: updatedList,
            taxPaid: cycleTaxes[cycleKey],
          });
          setSyncStatus('offline');
          showToast('นำวันหยุดไปใช้กับรอบนี้แบบออฟไลน์แล้ว');
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการบันทึกรอบวันหยุดบนคลาวด์');
        }
      }
    } else {
      showToast('นำวันหยุดไปใช้กับรอบนี้สำเร็จ');
    }
  };

  // 9: When clicking day in Calendar view
  const handleSelectRecord = (record: DailyRecord) => {
    setSelectedRecord(record);
    setIsRecordModalOpen(true);
  };

  // Quick add from navbar -> routes to calendar or opens today's modal
  const handleQuickAdd = () => {
    if (!user) {
      showToast('กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งาน');
      return;
    }
    if (currentView !== 'calendar') {
      setCurrentView('calendar');
      showToast('เลือกวันที่ในปฏิทินเพื่อบันทึก OT');
    } else {
      const today = currentRecords[0];
      if (today) {
        setSelectedRecord(today);
        setIsRecordModalOpen(true);
      }
    }
  };

  // 2: ลบข้อมูลการบันทึกทั้งหมดให้เริ่มการบันทึกใหม่ โดยวันเริ่มทำงานให้กำหนดได้เอง แล้วให้เริ่มบันทึกข้อมูลตั้งแต่ตอนนั้น
  const handleResetData = () => {
    if (!user) {
      showToast('กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งาน');
      return;
    }
    setResetStartDateInput(settings.workStartDate || '');
    setIsResetConfirmModalOpen(true);
  };

  const handleConfirmResetAndStartFresh = async (startDate: string) => {
    if (!user) return;
    const sessionUid = user.uid;
    const sessionSeq = authSessionSeqRef.current;

    cancelPendingTimersAndCaptureOffline(null);

    const updatedSettings: PayrollSettings = {
      ...DEFAULT_SETTINGS,
      workStartDate: startDate,
    };

    setSyncStatus('saving');
    try {
      await cleanStartUserCloudData(sessionUid);
      if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
        return;
      }
      if (startDate && startDate.trim() !== '') {
        await saveUserSettings(sessionUid, updatedSettings);
      }
      if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
        return;
      }
      setSyncStatus('synced');
    } catch (err) {
      console.error('Clean start failed:', err);
      if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
        clearAllUserLocalData(sessionUid);
        setSyncStatus('error');
      } else {
        return;
      }
    }

    skipNextSettingsSyncRef.current = true;
    skipNextHolidaysSyncRef.current = true;
    skipNextIncrementsSyncRef.current = true;

    setSettings(updatedSettings);

    // ล้างข้อมูลทุกรอบให้สะอาด 0 OT
    let nextCycles: Record<string, DailyRecord[]> = {};
    if (startDate && startDate.trim() !== '') {
      const freshCycle = createCycleRecords(targetYear, targetMonth, updatedSettings, []);
      nextCycles = { [cycleKey]: freshCycle };
    }
    setAllCycleRecords(nextCycles);
    setHolidays([]);
    setSalaryIncrements([]);
    setCycleTaxes({});
    setPaySlips([]);
    saveUserLocalCache(sessionUid, {
      settings: updatedSettings,
      allCycleRecords: nextCycles,
      holidays: [],
      salaryIncrements: [],
      cycleTaxes: {},
      paySlips: [],
    });
    setIsResetConfirmModalOpen(false);
    showToast(startDate ? `ล้างข้อมูลทั้งหมดแล้ว เริ่มบันทึกใหม่ตั้งแต่วันที่ ${startDate}` : 'ล้างข้อมูลทั้งหมด (Clean Start) เรียบร้อยแล้ว');
  };

  // Save / Update Pay Slip Photo Attachment (Online-first + Offline Queue Fallback)
  const handleSavePaySlip = async (slip: PaySlipAttachment) => {
    const isUpdate = paySlips.some((s) => s.id === slip.id);
    const nextSlips = (() => {
      const filtered = paySlips.filter((s) => s.id !== slip.id);
      return [slip, ...filtered].sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
    })();
    setPaySlips(nextSlips);

    if (user) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      const enrichedSlip: PaySlipAttachment = { ...slip, userId: sessionUid };
      saveUserLocalCache(sessionUid, { paySlips: nextSlips });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'SAVE_PAYSLIP', { slip: enrichedSlip });
        setSyncStatus('offline');
        if (!isUpdate) showToast('บันทึกสลิปเงินเดือนแบบออฟไลน์แล้ว (รอซิงค์เมื่อออนไลน์)');
        return;
      }

      setSyncStatus('saving');
      try {
        const writeStartMs = Date.now();
        await saveUserPaySlip(sessionUid, enrichedSlip);
        clearPendingSyncForPaySlip(sessionUid, enrichedSlip.id, writeStartMs);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus(hasPendingSync(sessionUid) ? 'offline' : 'synced');
          if (!isUpdate) showToast('บันทึกภาพสลิปเงินเดือนสำเร็จ (บันทึกบนคลาวด์แล้ว)');
        }
      } catch (e) {
        console.error('Failed to save pay slip to cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'SAVE_PAYSLIP', { slip: enrichedSlip });
          setSyncStatus('offline');
          if (!isUpdate) showToast('บันทึกสลิปเงินเดือนแบบออฟไลน์แล้ว');
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการบันทึกสลิปบนคลาวด์');
        }
      }
    } else if (!isUpdate) {
      showToast('บันทึกภาพสลิปเงินเดือนสำเร็จ');
    }
  };

  const handleDeletePaySlip = async (slipId: string) => {
    const nextSlips = paySlips.filter((s) => s.id !== slipId);
    setPaySlips(nextSlips);

    if (user) {
      const sessionUid = user.uid;
      const sessionSeq = authSessionSeqRef.current;
      saveUserLocalCache(sessionUid, { paySlips: nextSlips });

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueuePendingSync(sessionUid, 'DELETE_PAYSLIP', { slipId });
        setSyncStatus('offline');
        showToast('ลบสลิปเงินเดือนแบบออฟไลน์แล้ว');
        return;
      }

      setSyncStatus('saving');
      try {
        const writeStartMs = Date.now();
        await deleteUserPaySlip(sessionUid, slipId);
        clearPendingSyncForPaySlip(sessionUid, slipId, writeStartMs);
        if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
          setSyncStatus(hasPendingSync(sessionUid) ? 'offline' : 'synced');
          showToast('ลบสลิปเงินเดือนสำเร็จ');
        }
      } catch (e) {
        console.error('Failed to delete pay slip on cloud:', e);
        if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
          return;
        }
        if (isNetworkOrOfflineError(e)) {
          enqueuePendingSync(sessionUid, 'DELETE_PAYSLIP', { slipId });
          setSyncStatus('offline');
          showToast('ลบสลิปเงินเดือนแบบออฟไลน์แล้ว');
        } else {
          setSyncStatus('error');
          showToast('เกิดข้อผิดพลาดในการลบสลิปบนคลาวด์');
        }
      }
    } else {
      showToast('ลบสลิปเงินเดือนสำเร็จ');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'วันที่ (Date)',
      'วันในสัปดาห์ (Day)',
      'ช่วงกะ (Shift)',
      'สถานะ (Status)',
      'OT 1.0 (ชม.)',
      'OT 1.5 (ชม.)',
      'OT 3.0 (ชม.)',
      'รวม OT (ชม.)',
      'ค่า OT (บาท)',
      'หมายเหตุ (Note)',
    ];

    const rows = currentRecords.map((r) => {
      const ot1_5 = Number(r.ot1_5) || 0;
      const ot1_0 = Number(r.ot1_0) || 0;
      const ot3_0 = Number(r.ot3_0) || 0;
      const dayHours = ot1_5 + ot1_0 + ot3_0;
      const dayEarn = 
        (ot1_0 * summary.ot1_0_rate) +
        (ot1_5 * summary.ot1_5_rate) +
        (ot3_0 * summary.ot3_0_rate);

      return [
        `"${r.date}"`,
        `"${r.dayOfWeek}"`,
        `"${r.shiftPeriod || 'DAY'}"`,
        `"${r.shiftType}"`,
        ot1_0,
        ot1_5,
        ot3_0,
        dayHours,
        dayEarn.toFixed(2),
        `"${(r.note || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const summaryRow = [
      '"รวมทั้งสิ้น (TOTAL)"',
      '""',
      '""',
      '""',
      summary.totalOt1_0_hours,
      summary.totalOt1_5_hours,
      summary.totalOt3_0_hours,
      summary.totalOtHours,
      summary.totalOtAmount.toFixed(2),
      `"เงินได้รวมก่อนหัก: ฿${summary.totalGrossIncome.toFixed(2)}"`,
    ].join(',');

    const csvContent = '\uFEFF' + [headers.join(','), ...rows, summaryRow].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OT_Report_${settings.employeeName}_${cycleKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('ดาวน์โหลดไฟล์ CSV สำเร็จ');
  };

  const requireLoginNotice = () => {
    showToast('กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งาน');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-['Prompt',sans-serif] transition-colors duration-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 dark:border-slate-300 animate-in slide-in-from-bottom duration-300">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 5: Main Navbar with Compact Hamburger Menu & Enhanced Cycle Selector */}
      <Navbar
        currentView={currentView}
        setCurrentView={(view) => {
          if (!user) {
            requireLoginNotice();
            return;
          }
          if (view === 'dashboard') {
            setOverallNavTarget(null);
            if (currentView === 'dashboard') {
              setOverallResetSignal((prev) => prev + 1);
            }
          }
          setCurrentView(view);
        }}
        onOpenRecordModal={handleQuickAdd}
        onOpenSettingsModal={() => (user ? setIsSettingsModalOpen(true) : requireLoginNotice())}
        onOpenPaySlipModal={() => (user ? setIsPaySlipModalOpen(true) : requireLoginNotice())}
        onOpenPaySlipVault={() => {
          if (!user) {
            requireLoginNotice();
            return;
          }
          setOverallNavTarget({ module: 'payslip_vault', nonce: Date.now() });
          setCurrentView('dashboard');
        }}
        onOpenBrandEditModal={() => (user ? setIsBrandEditModalOpen(true) : requireLoginNotice())}
        onExportCsv={() => (user ? handleExportCsv() : requireLoginNotice())}
        onResetData={handleResetData}
        settings={user ? settings : DEFAULT_SETTINGS}
        cycleLabel={user ? cycleLabel : ''}
        cycleOffset={cycleOffset}
        targetYear={targetYear}
        targetMonth={targetMonth}
        hasWorkStartDate={user ? hasWorkStartDate : false}
        minYear={startCycle.year}
        maxYear={latestCycle.year}
        minMonth={startCycle.month}
        maxMonth={latestCycle.month}
        isPrevDisabled={!user || cycleOffset <= minCycleOffset}
        isNextDisabled={!user || cycleOffset >= maxCycleOffset}
        isCurrentPeriod={user ? isCurrentPeriod : true}
        onResetToCurrentCycle={() => {
          if (!user) return;
          const baseYear = 2026;
          const baseMonth = 9;
          const targetOffset = getMonthDiff(baseYear, baseMonth, currentPeriod.cycleYear, currentPeriod.cycleMonth);
          const clamped = Math.max(minCycleOffset, Math.min(maxCycleOffset, targetOffset));
          setCycleOffset(clamped);
          showToast('กลับมารอบตัดวิกปัจจุบันแล้ว');
        }}
        onSelectCycle={(navYear, navMonth) => {
          if (!user) return;
          const baseYear = 2026;
          const baseMonth = 9;
          const offset = getMonthDiff(baseYear, baseMonth, navYear, navMonth);
          const clamped = Math.max(minCycleOffset, Math.min(maxCycleOffset, offset));
          setCycleOffset(clamped);
          const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
          showToast(`เปลี่ยนไปยังรอบเดือน ${thaiMonths[navMonth]} ${navYear} สำเร็จ`);
        }}
        onPrevCycle={() => {
          if (!user || !hasWorkStartDate) return;
          setCycleOffset((prev) => Math.max(minCycleOffset, prev - 1));
        }}
        onNextCycle={() => {
          if (!user || !hasWorkStartDate) return;
          setCycleOffset((prev) => Math.min(maxCycleOffset, prev + 1));
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6">
        {authLoading ? (
          /* Clean Auth Check Loading State (No stale user data rendered) */
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-200/70 dark:border-indigo-800/60 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              กำลังตรวจสอบสถานะการเข้าสู่ระบบ...
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              กรุณารอสักครู่ ระบบกำลังเตรียมพื้นที่ทำงานที่ปลอดภัยสำหรับคุณ
            </p>
          </div>
        ) : !user ? (
          /* Clean Empty / Logged-Out State (Zero user data, zero mock data) */
          <div className="min-h-[62vh] flex items-center justify-center py-8 px-2">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 text-center space-y-6">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Lock className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  OT PayMaster
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  ยังไม่มีบัญชีผู้ใช้งานในระบบ กรุณาเข้าสู่ระบบด้วย Google เพื่อดูข้อมูลตารางเวลา ปฏิทินกะ วันลา สลิปเงินเดือน และประวัติของคุณ
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl p-3.5 text-left flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  ข้อมูลทั้งหมดถูกแยกจัดเก็บและซิงค์อย่างปลอดภัยเฉพาะบัญชี (UID) ของคุณเท่านั้น
                </span>
              </div>

              {authError && (
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-3 text-xs text-rose-700 dark:text-rose-300 text-left">
                  <div className="font-bold">แจ้งเตือนการเข้าสู่ระบบ: {authError.code}</div>
                  <div className="text-[11px] mt-0.5">{authError.message}</div>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => signInWithGoogle('auto').catch(() => {})}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
                >
                  <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>เข้าสู่ระบบด้วย Google</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => signInWithGooglePopup().catch(() => {})}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Monitor className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Popup (PC)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => signInWithGoogleRedirect().catch(() => {})}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Redirect (มือถือ)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 1. TIMESHEET / MAIN DASHBOARD VIEW (ตารางเวลา & แดชบอร์ดหลัก) */}
            {currentView === 'timesheet' && (
              <div className="space-y-5 sm:space-y-6">
                {/* การ์ดสรุปตัวเลขหลัก: เงินได้สุทธิ (คำนวณหักภาษีที่จ่ายไป), เงินได้ก่อนหักภาษี, ค่า OT รวม, สวัสดิการรวม */}
                <MainMetricsCards
                  summary={summary}
                  settings={currentCycleSettings}
                  cycleTaxPaid={currentCycleTax}
                  onOpenPaySlip={() => setIsPaySlipModalOpen(true)}
                  onUpdateTaxPaid={(taxVal) => handleUpdateCycleTax(cycleKey, taxVal)}
                />

                {/* 2: OT Share Card พร้อม Compact Horizontal Leave Summary Bar ด้านใน (อยู่ใต้ส่วน OT Share และเหนือแถวสรุปชั่วโมง OT ด้านล่าง) */}
                <OTShareCard 
                  summary={summary}
                  settings={currentCycleSettings}
                  cycleYear={targetYear}
                  onGoToLeaveView={() => {
                    setOverallNavTarget({ module: 'yearly_leave', nonce: Date.now() });
                    setCurrentView('dashboard');
                  }}
                />

                {/* ตารางบันทึกเวลา (หน้าเดียว) */}
                <TimesheetTable
                  records={currentRecords}
                  summary={summary}
                  settings={currentCycleSettings}
                  onGoToCalendar={() => setCurrentView('calendar')}
                  latestDate={latestCycle.latestDate}
                />
              </div>
            )}

            {/* 2. CALENDAR VIEW (2: ปฏิทืนกะ ให้แสดงเป็นหน้าแยกเหมือน บันทึกการลา & 9: ONLY place to record/edit OT!) */}
            {currentView === 'calendar' && (
              <div className="space-y-5 sm:space-y-6">
                
                {/* Dedicated Calendar Page Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 border border-indigo-500/20 shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                        <CalendarIcon className="w-5 h-5" />
                      </span>
                      <span className="text-xs uppercase tracking-wider font-bold text-indigo-300">
                        ระบบปฏิทินกะ & บันทึกการทำงาน (Shift Calendar)
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
                      ปฏิทินกะทำงานและบันทึก OT {cycleLabel ? `ประจำรอบ ${cycleLabel}` : ''}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      คลิกที่ช่องวันที่ในตารางปฏิทินเพื่อบันทึกหรือแก้ไขชั่วโมง OT หรือลงสถานะวันลา (ป่วย E, กิจ D, พักร้อน J)
                    </p>
                  </div>

                  {/* Action Buttons in Calendar Header */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                    {settings.shiftWorkEnabled && (
                      <button
                        onClick={handleReapplyShiftPattern}
                        title="คำนวณและปรับผังกะ Day/Night และวันหยุดเสาร์ให้อัตโนมัติตามกฎ 2 สัปดาห์"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>จัดตารางกะอัตโนมัติรอบนี้</span>
                      </button>
                    )}

                    <button
                      onClick={() => setIsPaySlipModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                    >
                      <span>ดูสลิปเงินเดือน</span>
                    </button>
                  </div>
                </div>

                {/* Shift Quick Bar: If Shift Work Enabled */}
                {settings.shiftWorkEnabled && hasWorkStartDate && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
                        กะ {settings.shiftGroup}
                      </span>
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ระบบกะ: สลับ 2 สัปดาห์ Day / 2 สัปดาห์ Night
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 block sm:inline sm:ml-2">
                          (สลับเสาร์หยุด Shift A/B)
                        </span>
                      </div>
                    </div>

                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      <span>รอบวิก: </span>
                      <strong className="text-slate-700 dark:text-slate-200">{cycleLabel}</strong>
                    </div>
                  </div>
                )}

                {/* Calendar Grid Component */}
                <CalendarView
                  records={currentRecords}
                  summary={summary}
                  settings={currentCycleSettings}
                  onSelectDate={handleSelectRecord}
                  latestDate={latestCycle.latestDate}
                />
              </div>
            )}

            {/* 3. OVERALL HUB VIEW (Annual Financial, Salary Increment, Yearly Leave & Annual Holidays) */}
            {currentView === 'dashboard' && (
              <div className="space-y-6">
                <YearlyDashboard
                  allCycleRecords={allCycleRecords}
                  cycleTaxes={cycleTaxes}
                  settings={settings}
                  salaryIncrements={salaryIncrements}
                  onUpdateSalaryIncrements={handleUpdateSalaryIncrements}
                  onUpdateCycleTax={handleUpdateCycleTax}
                  resetToHubSignal={overallResetSignal}
                  requestedModule={overallNavTarget}
                  minYear={startCycle.year}
                  maxYear={latestCycle.year}
                  holidays={holidays}
                  onAddHoliday={handleAddHoliday}
                  onUpdateHoliday={handleUpdateHoliday}
                  onDeleteHoliday={handleDeleteHoliday}
                  onApplyHolidaysToCurrentCycle={handleApplyHolidaysToCurrentCycle}
                  onCopyHolidaysFromYear={handleCopyHolidaysFromYear}
                  paySlips={paySlips}
                  currentCycleKey={cycleKey}
                  currentCycleNetIncome={summary.netIncome}
                  onSavePaySlip={handleSavePaySlip}
                  onDeletePaySlip={handleDeletePaySlip}
                  onUpdateYearlyTaxDeductions={handleUpdateYearlyTaxDeductions}
                  onNotify={showToast}
                  onNavigateToCycle={(navYear, navMonth) => {
                    const baseYear = 2026;
                    const baseMonth = 9;
                    const offset = (navYear - baseYear) * 12 + (navMonth - baseMonth);
                    setCycleOffset(offset);
                    setCurrentView('timesheet');
                    showToast(`เปลี่ยนไปยังรอบเดือน ${navMonth + 1}/${navYear} สำเร็จ`);
                  }}
                  onUpdateBaseSalary={(newSalary) => {
                    setSettings((prev) => ({
                      ...prev,
                      baseSalary: newSalary,
                    }));
                    showToast(`อัปเดตฐานเงินเดือนใหม่เป็น ${formatMoney(newSalary)} สำเร็จ`);
                  }}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer (Hides personal employeeName / department when logged out) */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-12 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-white">OT PayMaster</span>
            {user && (
              <>
                <span>•</span>
                <span>พนักงาน: {settings.employeeName || '-'} ({settings.department || '-'})</span>
              </>
            )}
          </div>
          <div>
            <span>
              {user
                ? `คำนวณตามมาตรฐาน พ.ร.บ.คุ้มครองแรงงาน • รอบตัดวิก ${settings.cycleStartDay} - ${settings.cycleEndDay}`
                : 'คำนวณตามมาตรฐาน พ.ร.บ.คุ้มครองแรงงาน • กรุณาเข้าสู่ระบบเพื่อใช้งาน'}
            </span>
          </div>
        </div>
      </footer>

      {/* Record Modal (OT editing exclusively from calendar - only when logged in) */}
      {user && isRecordModalOpen && selectedRecord && (
        <RecordModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          record={selectedRecord}
          onSave={handleUpdateRecord}
          summary={summary}
          settings={currentCycleSettings}
        />
      )}

      {/* Settings Modal (only when logged in) */}
      {user && isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={settings}
          onSaveSettings={async (newSettings: PayrollSettings) => {
            skipNextSettingsSyncRef.current = true;
            setSettings(newSettings);
            let nextCycles = allCycleRecords;
            if (newSettings.workStartDate) {
              const updatedCycles: Record<string, DailyRecord[]> = {};
              Object.entries(allCycleRecords).forEach(([key, recs]) => {
                updatedCycles[key] = recs.map((r) => {
                  const isBefore = Boolean(newSettings.workStartDate && r.date < newSettings.workStartDate);
                  return {
                    ...r,
                    isBeforeWorkStart: isBefore,
                    note: isBefore && (!r.note || r.note === 'ก่อนวันเริ่มทำงาน') ? 'ก่อนวันเริ่มทำงาน' : r.note,
                  };
                });
              });
              nextCycles = updatedCycles;
              setAllCycleRecords(updatedCycles);
            }

            if (user && isCloudLoaded) {
              const sessionUid = user.uid;
              const sessionSeq = authSessionSeqRef.current;
              saveUserLocalCache(sessionUid, {
                settings: newSettings,
                allCycleRecords: nextCycles,
              });

              if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: newSettings });
                setSyncStatus('offline');
                showToast('บันทึกการตั้งค่าแบบออฟไลน์แล้ว (รอซิงค์เมื่อออนไลน์)');
                return;
              }

              setSyncStatus('saving');
              try {
                await saveUserSettings(sessionUid, newSettings);
                if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
                  setSyncStatus('synced');
                  showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว (บันทึกบนคลาวด์แล้ว)');
                }
              } catch (e) {
                console.error('Failed to save settings to cloud:', e);
                if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
                  return;
                }
                if (isNetworkOrOfflineError(e)) {
                  enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: newSettings });
                  setSyncStatus('offline');
                  showToast('บันทึกการตั้งค่าแบบออฟไลน์แล้ว (รอซิงค์เมื่อออนไลน์)');
                } else {
                  setSyncStatus('error');
                  showToast('เกิดข้อผิดพลาดในการบันทึกการตั้งค่าบนคลาวด์');
                }
              }
            } else {
              showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว');
            }
          }}
        />
      )}

      {/* PaySlip Modal (only when logged in) */}
      {user && isPaySlipModalOpen && (
        <PaySlipModal
          isOpen={isPaySlipModalOpen}
          onClose={() => setIsPaySlipModalOpen(false)}
          summary={summary}
          settings={currentCycleSettings}
          cycleLabel={cycleLabel}
          cycleKey={cycleKey}
          attachedSlip={paySlips.find((s) => s.cycleKey === cycleKey) || null}
          onNotify={showToast}
          onIncrementDownloadCount={handleSavePaySlip}
          onOpenPaySlipVault={() => {
            setOverallNavTarget({ module: 'payslip_vault', nonce: Date.now() });
            setCurrentView('dashboard');
          }}
        />
      )}

      {/* Brand Edit Modal (only when logged in) */}
      {user && isBrandEditModalOpen && (
        <BrandEditModal
          isOpen={isBrandEditModalOpen}
          onClose={() => setIsBrandEditModalOpen(false)}
          appName={settings.appName || 'OT PayMaster'}
          appIcon={settings.appIcon || 'Calculator'}
          appSubtitle={settings.appSubtitle || 'ระบบคำนวณโอทีและสลิปเงินเดือน'}
          onSave={async (newName, newIcon, newSubtitle) => {
            const nextSettings = {
              ...settings,
              appName: newName,
              appIcon: newIcon,
              appSubtitle: newSubtitle,
            };
            skipNextSettingsSyncRef.current = true;
            setSettings(nextSettings);

            if (user && isCloudLoaded) {
              const sessionUid = user.uid;
              const sessionSeq = authSessionSeqRef.current;
              saveUserLocalCache(sessionUid, { settings: nextSettings });

              if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
                setSyncStatus('offline');
                showToast(`บันทึกชื่อ "${newName}" แบบออฟไลน์แล้ว`);
                return;
              }

              setSyncStatus('saving');
              try {
                await saveUserSettings(sessionUid, nextSettings);
                if (authSessionSeqRef.current === sessionSeq && auth.currentUser?.uid === sessionUid) {
                  setSyncStatus('synced');
                  showToast(`บันทึกชื่อ "${newName}" เรียบร้อยแล้ว (บันทึกบนคลาวด์แล้ว)`);
                }
              } catch (e) {
                console.error('Failed to save branding to cloud:', e);
                if (authSessionSeqRef.current !== sessionSeq || auth.currentUser?.uid !== sessionUid) {
                  return;
                }
                if (isNetworkOrOfflineError(e)) {
                  enqueuePendingSync(sessionUid, 'SAVE_SETTINGS', { settings: nextSettings });
                  setSyncStatus('offline');
                  showToast(`บันทึกชื่อ "${newName}" แบบออฟไลน์แล้ว`);
                } else {
                  setSyncStatus('error');
                  showToast('เกิดข้อผิดพลาดในการบันทึกชื่อแบรนด์บนคลาวด์');
                }
              }
            } else {
              showToast(`บันทึกชื่อ "${newName}" และไอคอนเรียบร้อยแล้ว`);
            }
          }}
        />
      )}

      {/* Reset & Start Fresh Modal (only when logged in) */}
      {user && isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">ลบข้อมูลทั้งหมด & เริ่มบันทึกใหม่</h3>
                  <p className="text-xs text-rose-200">กำหนดวันเริ่มทำงานแล้วเริ่มบันทึกใหม่</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-3.5 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>คำเตือน: ข้อมูลการบันทึกทั้งหมดจะถูกล้าง</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
                  ระบบจะล้างข้อมูลโอทีและสถิติทั้งหมดที่เคยบันทึกไว้ ให้เป็นตารางทำงานที่สะอาด (0 OT) เพื่อให้คุณเริ่มต้นบันทึกข้อมูลการทำงานจริง
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  กำหนดวันเริ่มทำงาน (Work Start Date)
                </label>
                <input
                  type="date"
                  value={resetStartDateInput}
                  onChange={(e) => setResetStartDateInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
                  💡 ระบบจะเริ่มบันทึกข้อมูลและคำนวณการทำงานตั้งแต่วันที่ <strong>{resetStartDateInput || '(ยังไม่กำหนด)'}</strong> เป็นต้นไป (วันก่อนหน้าจะแสดงสถานะ "ก่อนเริ่มงาน")
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetConfirmModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmResetAndStartFresh(resetStartDateInput)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>ยืนยันล้างข้อมูล & เริ่มต้นใหม่</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
