import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DailyRecord, Holiday, PayrollSettings, AppView, SalaryIncrementRecord } from './types/overtime';
import { 
  calculatePayroll, 
  createCycleRecords, 
  isValidDateString, 
  formatCurrency, 
  getEffectiveSalaryForCycle,
  getCycleForDate,
  getLatestCycleAndDate,
  getMonthDiff
} from './utils/calculator';
import { DEFAULT_SETTINGS, getInitialRecords } from './data/initialData';
import { DEFAULT_HOLIDAYS } from './data/holidays';
import { DEFAULT_SALARY_INCREMENTS } from './data/initialSalaryIncrements';
import { Navbar } from './components/Navbar';
import { MainMetricsCards } from './components/MainMetricsCards';
import { MainLeaveSummary } from './components/MainLeaveSummary';
import { OTShareCard } from './components/OTShareCard';
import { TimesheetTable } from './components/TimesheetTable';
import { CalendarView } from './components/CalendarView';
import { YearlyLeaveView } from './components/YearlyLeaveView';
import { HolidayCalendar } from './components/HolidayCalendar';
import { RecordModal } from './components/RecordModal';
import { SettingsModal } from './components/SettingsModal';
import { PaySlipModal } from './components/PaySlipModal';
import { BrandEditModal } from './components/BrandEditModal';
import { CycleIncomeChart } from './components/CycleIncomeChart';
import { YearlyDashboard } from './components/YearlyDashboard';
import { useAuth } from './context/AuthContext';
import { 
  clearOtAppLocalStorage,
  cleanStartUserCloudData,
  subscribeUserProfile,
  subscribeUserSettings,
  subscribeUserCycles,
  subscribeUserHolidays,
  subscribeUserSalaryIncrements,
  saveUserSettings, 
  fetchUserSettings, 
  saveUserCycle, 
  fetchUserCycles, 
  saveUserHolidays, 
  fetchUserHolidays, 
  saveUserSalaryIncrements, 
  fetchUserSalaryIncrements,
  deleteUserHoliday,
  deleteUserSalaryIncrement
} from './services/firestoreSync';
import { 
  CheckCircle,
  RefreshCw,
  Calendar as CalendarIcon,
  Briefcase,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';

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

  // 6: Holidays state (v5: ลบข้อมูลเก่าออก เริ่มต้นเป็นลิสต์ว่างให้ผู้ใช้คีย์ข้อมูลขึ้นมาเอง)
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    try {
      const saved = localStorage.getItem('ot_app_holidays_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_HOLIDAYS; // []
  });

  useEffect(() => {
    try {
      localStorage.setItem('ot_app_holidays_v5', JSON.stringify(holidays));
    } catch (e) {
      console.error(e);
    }
  }, [holidays]);

  // Settings state (v8: สะอาดเริ่มต้นว่างทั้งหมด พร้อมใช้งานจริง)
  const [settings, setSettings] = useState<PayrollSettings>(() => {
    try {
      const saved = localStorage.getItem('ot_app_settings_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          yearlyVacationQuotas: parsed.yearlyVacationQuotas || DEFAULT_SETTINGS.yearlyVacationQuotas,
          workStartDate: parsed.workStartDate !== undefined ? parsed.workStartDate : '',
        };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ot_app_settings_v8', JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  }, [settings]);

  // Salary increments state (v2: ว่างเริ่มต้น พร้อมใช้งานจริง)
  const [salaryIncrements, setSalaryIncrements] = useState<SalaryIncrementRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ot_app_salary_increments_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any, idx: number) => ({
            ...item,
            effectiveMonth: item.effectiveMonth || `${item.effectiveYear || (2022 + (item.tenureYear ?? idx))}-10`,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SALARY_INCREMENTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ot_app_salary_increments_v2', JSON.stringify(salaryIncrements));
    } catch (e) {
      console.error(e);
    }
  }, [salaryIncrements]);

  // 2: Multi-cycle records (v8: เริ่มต้นว่างทั้งหมด พร้อมใช้งานจริง)
  const [allCycleRecords, setAllCycleRecords] = useState<Record<string, DailyRecord[]>>(() => {
    try {
      const saved = localStorage.getItem('ot_app_all_cycles_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const sanitized: Record<string, DailyRecord[]> = {};
          let hasInvalid = false;
          Object.entries(parsed).forEach(([key, recs]) => {
            if (Array.isArray(recs)) {
              const filtered = recs.filter((r) => isValidDateString(r.date));
              if (filtered.length !== recs.length) hasInvalid = true;
              sanitized[key] = filtered;
            }
          });
          if (!hasInvalid && Object.keys(sanitized).length > 0) {
            return sanitized;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('ot_app_all_cycles_v8', JSON.stringify(allCycleRecords));
    } catch (e) {
      console.error(e);
    }
  }, [allCycleRecords]);

  const hasWorkStartDate = Boolean(settings.workStartDate && settings.workStartDate.trim() !== '');

  // 3. วันที่ รอบเดือน รอบปี ต่างๆ ให้เริ่มแสดงจากวันที่เริ่มทำงาน และแสดงจนถึงวันที่ รอบเดือน รอบปี ล่าสุดเท่านั้น
  const { startCycle, latestCycle, minCycleOffset, maxCycleOffset } = useMemo(() => {
    const baseYear = 2026;
    const baseMonth = 9; // October (0-indexed: 9 = Oct)

    if (!hasWorkStartDate) {
      return {
        startCycle: { year: 2026, month: 9, cycleKey: '2026-10' },
        latestCycle: { year: 2026, month: 9, cycleKey: '2026-10', latestDate: '2026-10-26' },
        minCycleOffset: 0,
        maxCycleOffset: 0,
      };
    }

    const start = getCycleForDate(settings.workStartDate!, settings.cycleStartDay, settings.cycleEndDay);
    const recordedKeys = Object.keys(allCycleRecords);
    const latest = getLatestCycleAndDate(settings.cycleStartDay, settings.cycleEndDay, recordedKeys);

    const minOffset = getMonthDiff(baseYear, baseMonth, start.year, start.month);
    const maxOffset = getMonthDiff(baseYear, baseMonth, latest.year, latest.month);

    return {
      startCycle: start,
      latestCycle: latest,
      minCycleOffset: minOffset,
      maxCycleOffset: Math.max(minOffset, maxOffset),
    };
  }, [hasWorkStartDate, settings.workStartDate, settings.cycleStartDay, settings.cycleEndDay, allCycleRecords]);

  // Cycle navigation offset (0 = 2026-10 / current base, -1 = prev, +1 = next)
  const [cycleOffset, setCycleOffset] = useState<number>(0);

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

  // Active cycle records
  const currentRecords = useMemo(() => {
    if (!hasWorkStartDate) return [];
    if (allCycleRecords[cycleKey] && allCycleRecords[cycleKey].length > 0) {
      // Ensure all dates are valid calendar dates
      return allCycleRecords[cycleKey].filter((r) => isValidDateString(r.date));
    }
    const fresh = createCycleRecords(targetYear, targetMonth, settings, holidays);
    return fresh;
  }, [hasWorkStartDate, allCycleRecords, cycleKey, targetYear, targetMonth, settings, holidays]);

  // 3: ภาษีที่จ่ายไปให้แยกการใส่เป็นรอบเดือน (v3: สะอาดเริ่มต้น 0 พร้อมใช้งานจริง)
  const [cycleTaxes, setCycleTaxes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('ot_app_cycle_taxes_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('ot_app_cycle_taxes_v3', JSON.stringify(cycleTaxes));
    } catch (e) {
      console.error(e);
    }
  }, [cycleTaxes]);

  const { user, setSyncStatus } = useAuth();
  const isInitialSyncDone = useRef(false);
  const isRemoteUpdate = useRef(false);

  // Setup Real-time Listeners (onSnapshot) and Cloud-Driven Local Reset
  useEffect(() => {
    if (!user) {
      isInitialSyncDone.current = false;
      return;
    }

    setSyncStatus('saving');
    let isSubscribed = true;

    // Check if initial one-time clean start should run for current user session
    const performInitialCleanStartIfNeeded = async () => {
      const cleanKey = `ot_app_clean_v1_${user.uid}`;
      if (localStorage.getItem(cleanKey) !== 'completed') {
        console.log('Executing approved Clean Start for UID:', user.uid);
        try {
          await cleanStartUserCloudData(user.uid);
          localStorage.setItem(cleanKey, 'completed');
          isRemoteUpdate.current = true;
          setSettings(DEFAULT_SETTINGS);
          setAllCycleRecords({});
          setCycleTaxes({});
          setHolidays([]);
          setSalaryIncrements([]);
          showToast('ล้างข้อมูลเริ่มต้นใหม่ (Clean Start) บน Cloud สำเร็จ');
        } catch (cleanErr) {
          console.error('Clean start initial error:', cleanErr);
        }
      }
    };
    performInitialCleanStartIfNeeded();

    // 1. Profile listener (Cloud-Driven Local Reset across devices)
    const unsubProfile = subscribeUserProfile(
      user.uid,
      (resetVersion) => {
        if (!isSubscribed) return;
        const currentLocalReset = localStorage.getItem('ot_app_applied_reset_version');
        if (resetVersion && currentLocalReset !== resetVersion) {
          console.log(`Cloud-driven reset detected: ${resetVersion}`);
          isRemoteUpdate.current = true;
          clearOtAppLocalStorage();
          localStorage.setItem('ot_app_applied_reset_version', resetVersion);
          setSettings(DEFAULT_SETTINGS);
          setAllCycleRecords({});
          setCycleTaxes({});
          setHolidays([]);
          setSalaryIncrements([]);
          showToast('ซิงค์สถานะเริ่มต้นใหม่ (Clean Start) จาก Cloud สำเร็จ');
        }
      },
      (err) => console.error('Profile listener error:', err)
    );

    // 2. Settings Real-time listener
    const unsubSettings = subscribeUserSettings(
      user.uid,
      (remoteSettings) => {
        if (!isSubscribed) return;
        if (remoteSettings) {
          isRemoteUpdate.current = true;
          setSettings((prev) => ({
            ...prev,
            ...remoteSettings,
            yearlyVacationQuotas: remoteSettings.yearlyVacationQuotas || prev.yearlyVacationQuotas,
          }));
        }
        setSyncStatus('synced');
      },
      (err) => console.error('Settings listener error:', err)
    );

    // 3. Cycles & Taxes Real-time listener
    const unsubCycles = subscribeUserCycles(
      user.uid,
      (remoteCycles, remoteTaxes) => {
        if (!isSubscribed) return;
        isRemoteUpdate.current = true;
        setAllCycleRecords(remoteCycles);
        setCycleTaxes(remoteTaxes);
        setSyncStatus('synced');
      },
      (err) => console.error('Cycles listener error:', err)
    );

    // 4. Holidays Real-time listener
    const unsubHolidays = subscribeUserHolidays(
      user.uid,
      (remoteHolidays) => {
        if (!isSubscribed) return;
        isRemoteUpdate.current = true;
        setHolidays(remoteHolidays);
        setSyncStatus('synced');
      },
      (err) => console.error('Holidays listener error:', err)
    );

    // 5. Salary Increments Real-time listener
    const unsubIncrements = subscribeUserSalaryIncrements(
      user.uid,
      (remoteIncrements) => {
        if (!isSubscribed) return;
        isRemoteUpdate.current = true;
        setSalaryIncrements(remoteIncrements);
        setSyncStatus('synced');
      },
      (err) => console.error('Salary increments listener error:', err)
    );

    isInitialSyncDone.current = true;

    return () => {
      isSubscribed = false;
      unsubProfile();
      unsubSettings();
      unsubCycles();
      unsubHolidays();
      unsubIncrements();
    };
  }, [user]);

  // Sync settings to Firestore
  useEffect(() => {
    if (!user || !isInitialSyncDone.current) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveUserSettings(user.uid, settings);
        setSyncStatus('synced');
      } catch (e) {
        console.error('Failed to sync settings:', e);
        setSyncStatus('error');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [settings, user]);

  // Sync salary increments to Firestore
  useEffect(() => {
    if (!user || !isInitialSyncDone.current) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveUserSalaryIncrements(user.uid, salaryIncrements);
        setSyncStatus('synced');
      } catch (e) {
        console.error('Failed to sync salary increments:', e);
        setSyncStatus('error');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [salaryIncrements, user]);

  // Sync holidays to Firestore
  useEffect(() => {
    if (!user || !isInitialSyncDone.current) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveUserHolidays(user.uid, holidays);
        setSyncStatus('synced');
      } catch (e) {
        console.error('Failed to sync holidays:', e);
        setSyncStatus('error');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [holidays, user]);

  const handleUpdateCycleTax = (cKey: string, val: number) => {
    setCycleTaxes((prev) => ({
      ...prev,
      [cKey]: val,
    }));
    if (user && isInitialSyncDone.current) {
      setSyncStatus('saving');
      saveUserCycle(user.uid, cKey, allCycleRecords[cKey] || currentRecords, val)
        .then(() => setSyncStatus('synced'))
        .catch((e) => {
          console.error(e);
          setSyncStatus('error');
        });
    }
  };

  // Views ('timesheet' | 'calendar' | 'holidays' | 'leave' | 'dashboard')
  const [currentView, setCurrentView] = useState<AppView>('timesheet');

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPaySlipModalOpen, setIsPaySlipModalOpen] = useState(false);
  const [isBrandEditModalOpen, setIsBrandEditModalOpen] = useState(false);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [resetStartDateInput, setResetStartDateInput] = useState<string>(settings.workStartDate || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Update year-by-year vacation quota
  const handleUpdateYearlyVacationQuota = (
    year: number,
    quotaData: { baseQuota: number; carriedOver?: number; note?: string }
  ) => {
    setSettings((prev) => {
      const existing = prev.yearlyVacationQuotas || DEFAULT_SETTINGS.yearlyVacationQuotas || {};
      const updated = {
        ...existing,
        [year]: {
          baseQuota: Number(quotaData.baseQuota) || 0,
          carriedOver: Number(quotaData.carriedOver) || 0,
          note: quotaData.note || '',
        },
      };
      return {
        ...prev,
        yearlyVacationQuotas: updated,
      };
    });
    showToast(`อัปเดตสิทธิ์วันลาพักร้อนปี ${year} เรียบร้อยแล้ว`);
  };

  const handleBatchUpdateVacationQuotas = (
    newQuotas: Record<number, { baseQuota: number; carriedOver?: number; note?: string }>
  ) => {
    setSettings((prev) => ({
      ...prev,
      yearlyVacationQuotas: newQuotas,
    }));
    showToast('อัปเดตตารางสิทธิ์วันลาพักร้อนรายปีสำเร็จ');
  };

  // Sync document title with customized app name
  useEffect(() => {
    if (settings.appName) {
      document.title = `${settings.appName} - ระบบคำนวณโอที`;
    }
  }, [settings.appName]);

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
  const handleUpdateRecord = (updated: DailyRecord) => {
    let nextList: DailyRecord[] = [];
    setAllCycleRecords((prev) => {
      const existing = prev[cycleKey] || currentRecords;
      const updatedList = existing.map((r) => (r.id === updated.id ? updated : r));
      nextList = updatedList;
      return {
        ...prev,
        [cycleKey]: updatedList,
      };
    });
    if (user && isInitialSyncDone.current) {
      setSyncStatus('saving');
      saveUserCycle(user.uid, cycleKey, nextList, cycleTaxes[cycleKey])
        .then(() => setSyncStatus('synced'))
        .catch((e) => {
          console.error(e);
          setSyncStatus('error');
        });
    }
    showToast(`อัปเดตข้อมูลวันที่ ${updated.dayNumber} สำเร็จ`);
  };

  // Re-apply shift pattern (2wk Day/Night & Sat A/B)
  const handleReapplyShiftPattern = () => {
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

    setAllCycleRecords((prev) => ({
      ...prev,
      [cycleKey]: merged,
    }));
    if (user && isInitialSyncDone.current) {
      setSyncStatus('saving');
      saveUserCycle(user.uid, cycleKey, merged, cycleTaxes[cycleKey])
        .then(() => setSyncStatus('synced'))
        .catch((e) => {
          console.error(e);
          setSyncStatus('error');
        });
    }
    showToast(`จัดตารางกะ ${settings.shiftGroup} สำเร็จ`);
  };

  // Holidays management (6: คีย์ข้อมูลขึ้นมาเอง)
  const handleAddHoliday = (newH: Omit<Holiday, 'id'>) => {
    const id = `hol-${Date.now()}`;
    const created: Holiday = { ...newH, id };
    setHolidays((prev) => [...prev, created]);
    showToast(`เพิ่มวันหยุด "${created.name}" สำเร็จ`);
  };

  const handleUpdateHoliday = (updatedH: Holiday) => {
    setHolidays((prev) => prev.map((h) => (h.id === updatedH.id ? updatedH : h)));
    showToast(`แก้ไขวันหยุด "${updatedH.name}" สำเร็จ`);
  };

  const handleDeleteHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    if (user && isInitialSyncDone.current) {
      deleteUserHoliday(user.uid, id).catch(console.error);
    }
    showToast('ลบวันหยุดสำเร็จ');
  };

  // Apply holidays to current cycle
  const handleApplyHolidaysToCurrentCycle = () => {
    const holidayMap = new Map<string, Holiday>();
    holidays.forEach((h) => holidayMap.set(h.date, h));

    setAllCycleRecords((prev) => {
      const existing = prev[cycleKey] || currentRecords;
      const updated = existing.map((r) => {
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
      return {
        ...prev,
        [cycleKey]: updated,
      };
    });
    showToast('นำวันหยุดไปใช้กับรอบนี้สำเร็จ');
  };

  // 9: When clicking day in Calendar view
  const handleSelectRecord = (record: DailyRecord) => {
    setSelectedRecord(record);
    setIsRecordModalOpen(true);
  };

  // Quick add from navbar -> routes to calendar or opens today's modal
  const handleQuickAdd = () => {
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
    setResetStartDateInput(settings.workStartDate || '');
    setIsResetConfirmModalOpen(true);
  };

  const handleConfirmResetAndStartFresh = async (startDate: string) => {
    const updatedSettings: PayrollSettings = {
      ...DEFAULT_SETTINGS,
      workStartDate: startDate,
    };

    if (user) {
      setSyncStatus('saving');
      try {
        await cleanStartUserCloudData(user.uid);
        if (startDate && startDate.trim() !== '') {
          await saveUserSettings(user.uid, updatedSettings);
        }
        setSyncStatus('synced');
      } catch (err) {
        console.error('Clean start failed:', err);
      }
    } else {
      clearOtAppLocalStorage();
    }

    setSettings(updatedSettings);

    // ล้างข้อมูลทุกรอบให้สะอาด 0 OT
    if (startDate && startDate.trim() !== '') {
      const freshCycle = createCycleRecords(targetYear, targetMonth, updatedSettings, []);
      setAllCycleRecords({
        [cycleKey]: freshCycle,
      });
    } else {
      setAllCycleRecords({});
    }
    setHolidays([]);
    setSalaryIncrements([]);
    setCycleTaxes({});
    setIsResetConfirmModalOpen(false);
    showToast(startDate ? `ล้างข้อมูลทั้งหมดแล้ว เริ่มบันทึกใหม่ตั้งแต่วันที่ ${startDate}` : 'ล้างข้อมูลทั้งหมด (Clean Start) เรียบร้อยแล้ว');
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
        setCurrentView={setCurrentView}
        onOpenRecordModal={handleQuickAdd}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenPaySlipModal={() => setIsPaySlipModalOpen(true)}
        onOpenBrandEditModal={() => setIsBrandEditModalOpen(true)}
        onExportCsv={handleExportCsv}
        onResetData={handleResetData}
        settings={settings}
        cycleLabel={cycleLabel}
        cycleOffset={cycleOffset}
        targetYear={targetYear}
        targetMonth={targetMonth}
        hasWorkStartDate={hasWorkStartDate}
        minYear={startCycle.year}
        maxYear={latestCycle.year}
        minMonth={startCycle.month}
        maxMonth={latestCycle.month}
        isPrevDisabled={cycleOffset <= minCycleOffset}
        isNextDisabled={cycleOffset >= maxCycleOffset}
        onResetToCurrentCycle={() => {
          setCycleOffset(maxCycleOffset);
          showToast('กลับมารอบตัดวิกปัจจุบันแล้ว');
        }}
        onSelectCycle={(navYear, navMonth) => {
          const baseYear = 2026;
          const baseMonth = 9;
          const offset = getMonthDiff(baseYear, baseMonth, navYear, navMonth);
          const clamped = Math.max(minCycleOffset, Math.min(maxCycleOffset, offset));
          setCycleOffset(clamped);
          const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
          showToast(`เปลี่ยนไปยังรอบเดือน ${thaiMonths[navMonth]} ${navYear} สำเร็จ`);
        }}
        onPrevCycle={() => {
          if (!hasWorkStartDate) return;
          setCycleOffset((prev) => Math.max(minCycleOffset, prev - 1));
        }}
        onNextCycle={() => {
          if (!hasWorkStartDate) return;
          setCycleOffset((prev) => Math.min(maxCycleOffset, prev + 1));
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6">
        
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

            {/* 1: D3 Bar Chart เปรียบเทียบรายได้รวมในแต่ละรอบเดือน (Cycle) */}
            <CycleIncomeChart
              allCycleRecords={allCycleRecords}
              cycleTaxes={cycleTaxes}
              settings={currentCycleSettings}
              currentCycleKey={cycleKey}
              onSelectCycle={(offset) => setCycleOffset(offset)}
            />

            {/* 4: กล่องแสดงวันลาต่างๆ (ป่วย E, กิจ D, พักร้อน J, รวมวันลา, วันหยุด H) */}
            <MainLeaveSummary
              summary={summary}
              settings={currentCycleSettings}
              cycleYear={targetYear}
              onGoToLeaveView={() => setCurrentView('leave')}
            />

            {/* 2: OT Share Card (รวม Donut ทางซ้าย และกล่องสรุปชั่วโมง OT รวม ไว้ด้วยกันในที่เดียว) */}
            <OTShareCard summary={summary} />

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

        {/* 3. YEARLY LEAVE VIEW (Annual leave summary with customizable year cycle) */}
        {currentView === 'leave' && (
          <div className="space-y-6">
            <YearlyLeaveView
              allCycleRecords={allCycleRecords}
              settings={settings}
              minYear={startCycle.year}
              maxYear={latestCycle.year}
            />
          </div>
        )}

        {/* 4. HOLIDAY CALENDAR VIEW (12: Filtered by year, 6: คีย์ข้อมูลขึ้นมาเอง) */}
        {currentView === 'holidays' && (
          <div className="space-y-6">
            <HolidayCalendar
              holidays={holidays}
              onAddHoliday={handleAddHoliday}
              onUpdateHoliday={handleUpdateHoliday}
              onDeleteHoliday={handleDeleteHoliday}
              onApplyToCurrentCycle={handleApplyHolidaysToCurrentCycle}
            />
          </div>
        )}

        {/* 5. YEARLY DASHBOARD VIEW (1: เพิ่มหน้า dash board เข้าไปต่อท้ายปุ่มวันหยุด แสดงการบันทึกประจำปีตามรูป) */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <YearlyDashboard
              allCycleRecords={allCycleRecords}
              cycleTaxes={cycleTaxes}
              settings={settings}
              salaryIncrements={salaryIncrements}
              onUpdateSalaryIncrements={setSalaryIncrements}
              onUpdateCycleTax={handleUpdateCycleTax}
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
                showToast(`อัปเดตฐานเงินเดือนใหม่เป็น ฿${formatCurrency(newSalary)} สำเร็จ`);
              }}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-12 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-white">OT PayMaster</span>
            <span>•</span>
            <span>พนักงาน: {settings.employeeName} ({settings.department})</span>
          </div>
          <div>
            <span>คำนวณตามมาตรฐาน พ.ร.บ.คุ้มครองแรงงาน • รอบตัดวิก {settings.cycleStartDay} - {settings.cycleEndDay}</span>
          </div>
        </div>
      </footer>

      {/* Record Modal (OT editing exclusively from calendar) */}
      {isRecordModalOpen && selectedRecord && (
        <RecordModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          record={selectedRecord}
          onSave={handleUpdateRecord}
          summary={summary}
          settings={currentCycleSettings}
        />
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={settings}
          onSaveSettings={(newSettings: PayrollSettings) => {
            setSettings(newSettings);
            if (newSettings.workStartDate) {
              setAllCycleRecords((prev) => {
                const next: Record<string, DailyRecord[]> = {};
                Object.entries(prev).forEach(([key, recs]) => {
                  next[key] = recs.map((r) => {
                    const isBefore = Boolean(newSettings.workStartDate && r.date < newSettings.workStartDate);
                    return {
                      ...r,
                      isBeforeWorkStart: isBefore,
                      note: isBefore && (!r.note || r.note === 'ก่อนวันเริ่มทำงาน') ? 'ก่อนวันเริ่มทำงาน' : r.note,
                    };
                  });
                });
                return next;
              });
            }
            showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว');
          }}
        />
      )}

      {/* PaySlip Modal */}
      {isPaySlipModalOpen && (
        <PaySlipModal
          isOpen={isPaySlipModalOpen}
          onClose={() => setIsPaySlipModalOpen(false)}
          summary={summary}
          settings={currentCycleSettings}
          cycleLabel={cycleLabel}
        />
      )}

      {/* 5: Brand Edit Modal (กำหนดให้แก้ไขชื่อและรูปไอคอนได้) */}
      {isBrandEditModalOpen && (
        <BrandEditModal
          isOpen={isBrandEditModalOpen}
          onClose={() => setIsBrandEditModalOpen(false)}
          appName={settings.appName || 'OT PayMaster'}
          appIcon={settings.appIcon || 'Calculator'}
          appSubtitle={settings.appSubtitle || 'ระบบคำนวณโอทีและสลิปเงินเดือน'}
          onSave={(newName, newIcon, newSubtitle) => {
            setSettings((prev) => ({
              ...prev,
              appName: newName,
              appIcon: newIcon,
              appSubtitle: newSubtitle,
            }));
            showToast(`บันทึกชื่อ "${newName}" และไอคอนเรียบร้อยแล้ว`);
          }}
        />
      )}

      {/* 2: Reset & Start Fresh Modal (กำหนดวันเริ่มทำงานได้เอง แล้วให้เริ่มบันทึกข้อมูลตั้งแต่ตอนนั้น) */}
      {isResetConfirmModalOpen && (
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
