import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, User } from '../firebase';
import { DailyRecord, Holiday, PayrollSettings, SalaryIncrementRecord, PaySlipAttachment } from '../types/overtime';

// Clear legacy unscoped keys and optionally all local data (including queue) for a specific UID
export function clearOtAppLocalStorage(userId?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (userId && key.startsWith(`ot_app_u_${userId}_`)) {
        keysToRemove.push(key);
      } else if (
        (key.startsWith('ot_app_') && !key.startsWith('ot_app_u_')) ||
        key.startsWith('gemini_supabase_')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.log('Cleaned OT app LocalStorage keys:', keysToRemove);
  } catch (e) {
    console.error('Failed to clear LocalStorage:', e);
  }
}

// Ensure user profile document exists
export async function syncUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const existing = await getDoc(userDocRef);
    const nowIso = new Date().toISOString();

    if (!existing.exists()) {
      await setDoc(userDocRef, {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } else {
      await setDoc(userDocRef, {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        updatedAt: nowIso,
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Clean Start: Wipe all cloud subcollections for ONLY current userId, then stamp cleanResetVersion
export async function cleanStartUserCloudData(userId: string): Promise<string> {
  const resetVersion = `clean_${Date.now()}`;
  console.log(`Starting clean start for user ${userId} with resetVersion ${resetVersion}...`);

  // 1. Delete all settings documents
  try {
    const settingsPath = `users/${userId}/settings`;
    const settingsDocs = await getDocs(collection(db, 'users', userId, 'settings'));
    for (const d of settingsDocs.docs) {
      await deleteDoc(doc(db, 'users', userId, 'settings', d.id));
    }
  } catch (e) {
    console.warn('Error clearing settings:', e);
  }

  // 2. Delete all cycle documents
  try {
    const cyclesDocs = await getDocs(collection(db, 'users', userId, 'cycles'));
    for (const d of cyclesDocs.docs) {
      await deleteDoc(doc(db, 'users', userId, 'cycles', d.id));
    }
  } catch (e) {
    console.warn('Error clearing cycles:', e);
  }

  // 3. Delete all holidays
  try {
    const holidaysDocs = await getDocs(collection(db, 'users', userId, 'holidays'));
    for (const d of holidaysDocs.docs) {
      await deleteDoc(doc(db, 'users', userId, 'holidays', d.id));
    }
  } catch (e) {
    console.warn('Error clearing holidays:', e);
  }

  // 4. Delete all salary increments
  try {
    const incrementsDocs = await getDocs(collection(db, 'users', userId, 'salaryIncrements'));
    for (const d of incrementsDocs.docs) {
      await deleteDoc(doc(db, 'users', userId, 'salaryIncrements', d.id));
    }
  } catch (e) {
    console.warn('Error clearing salary increments:', e);
  }

  // 4b. Delete all pay slips
  try {
    const paySlipsDocs = await getDocs(collection(db, 'users', userId, 'paySlips'));
    for (const d of paySlipsDocs.docs) {
      await deleteDoc(doc(db, 'users', userId, 'paySlips', d.id));
    }
  } catch (e) {
    console.warn('Error clearing pay slips:', e);
  }

  // 5. Update user profile with cleanResetVersion
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      cleanResetVersion: resetVersion,
      cleanResetAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn('Error updating resetVersion on user profile:', e);
  }

  // 6. Clear Local Storage for ONLY this userId on this device
  clearOtAppLocalStorage(userId);
  try {
    localStorage.setItem(`ot_app_u_${userId}_applied_reset_version`, resetVersion);
  } catch (e) {
    console.error(e);
  }

  console.log(`Clean start completed for user ${userId}`);
  return resetVersion;
}

// Real-time listener: User Profile (for Cloud-Driven Local Reset across devices)
export function subscribeUserProfile(
  userId: string,
  onResetDetected: (resetVersion: string) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = `users/${userId}`;
  const docRef = doc(db, 'users', userId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.cleanResetVersion) {
          onResetDetected(data.cleanResetVersion);
        }
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (formattedErr) {
        if (onError) onError(formattedErr);
      }
    }
  );
}

// Real-time listener: Payroll Settings
export function subscribeUserSettings(
  userId: string,
  onUpdate: (settings: PayrollSettings | null, updatedAt?: string) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = `users/${userId}/settings/current`;
  const docRef = doc(db, 'users', userId, 'settings', 'current');

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate(data as PayrollSettings, data.updatedAt);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (formattedErr) {
        if (onError) onError(formattedErr);
      }
    }
  );
}

// Real-time listener: Cycles and Tax
export function subscribeUserCycles(
  userId: string,
  onUpdate: (
    cycles: Record<string, DailyRecord[]>, 
    cycleTaxes: Record<string, number>, 
    updatedAtMap: Record<string, string>
  ) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = `users/${userId}/cycles`;
  const colRef = collection(db, 'users', userId, 'cycles');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const cycles: Record<string, DailyRecord[]> = {};
      const cycleTaxes: Record<string, number> = {};
      const updatedAtMap: Record<string, string> = {};

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const cKey = data.cycleKey || docSnap.id;
        if (Array.isArray(data.records)) {
          cycles[cKey] = data.records;
        }
        if (typeof data.taxPaid === 'number') {
          cycleTaxes[cKey] = data.taxPaid;
        }
        if (data.updatedAt) {
          updatedAtMap[cKey] = data.updatedAt;
        }
      });

      onUpdate(cycles, cycleTaxes, updatedAtMap);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (formattedErr) {
        if (onError) onError(formattedErr);
      }
    }
  );
}

// Real-time listener: Holidays
export function subscribeUserHolidays(
  userId: string,
  onUpdate: (holidays: Holiday[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = `users/${userId}/holidays`;
  const colRef = collection(db, 'users', userId, 'holidays');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const holidays: Holiday[] = [];
      snapshot.docs.forEach((docSnap) => {
        holidays.push(docSnap.data() as Holiday);
      });
      onUpdate(holidays);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (formattedErr) {
        if (onError) onError(formattedErr);
      }
    }
  );
}

// Real-time listener: Salary Increments
export function subscribeUserSalaryIncrements(
  userId: string,
  onUpdate: (increments: SalaryIncrementRecord[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = `users/${userId}/salaryIncrements`;
  const colRef = collection(db, 'users', userId, 'salaryIncrements');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const increments: SalaryIncrementRecord[] = [];
      snapshot.docs.forEach((docSnap) => {
        increments.push(docSnap.data() as SalaryIncrementRecord);
      });
      onUpdate(increments);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (formattedErr) {
        if (onError) onError(formattedErr);
      }
    }
  );
}

// Save Settings to Firestore
export async function saveUserSettings(userId: string, settings: PayrollSettings): Promise<void> {
  const path = `users/${userId}/settings/current`;
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'current');
    const cleanPayload: any = {
      userId,
      appName: settings.appName || '',
      appIcon: settings.appIcon || 'Calculator',
      appSubtitle: settings.appSubtitle || '',
      employeeName: settings.employeeName || '',
      employeeId: settings.employeeId || '',
      department: settings.department || '',
      workStartDate: settings.workStartDate || '',
      baseSalary: Number(settings.baseSalary) || 0,
      daysPerMonth: Number(settings.daysPerMonth) || 30,
      hoursPerDay: Number(settings.hoursPerDay) || 8,
      providentFundRate: Number(settings.providentFundRate) || 0,
      socialSecurityCap: Number(settings.socialSecurityCap) || 750,
      socialSecurityRate: Number(settings.socialSecurityRate) || 0.05,
      housingAllowance: Number(settings.housingAllowance) || 0,
      hardshipAllowance: Number(settings.hardshipAllowance) || 0,
      diligenceAmount: Number(settings.diligenceAmount) || 0,
      shiftAmount: Number(settings.shiftAmount) || 0,
      otherDeductions: Number(settings.otherDeductions) || 0,
      taxRateEstimate: Number(settings.taxRateEstimate) || 0,
      taxPaid: Number(settings.taxPaid) || 0,
      cycleStartDay: Number(settings.cycleStartDay) || 20,
      cycleEndDay: Number(settings.cycleEndDay) || 19,
      shiftWorkEnabled: Boolean(settings.shiftWorkEnabled),
      shiftGroup: settings.shiftGroup || 'A',
      shiftReferenceDate: settings.shiftReferenceDate || '',
      shiftReferencePeriod: settings.shiftReferencePeriod || 'DAY',
      leaveYearStartMonth: Number(settings.leaveYearStartMonth) || 1,
      leaveYearStartDay: Number(settings.leaveYearStartDay) || 1,
      leaveSickQuota: Number(settings.leaveSickQuota) || 30,
      leavePersonalQuota: Number(settings.leavePersonalQuota) || 6,
      leaveVacationQuota: Number(settings.leaveVacationQuota) || 8,
      updatedAt: new Date().toISOString(),
    };

    if (settings.yearlyVacationQuotas) {
      cleanPayload.yearlyVacationQuotas = settings.yearlyVacationQuotas;
    }

    if (settings.yearlyTaxDeductions) {
      const sanitizedTaxMap: Record<number, any> = {};
      Object.entries(settings.yearlyTaxDeductions).forEach(([yrKey, cfg]) => {
        if (!cfg || typeof cfg !== 'object') return;
        const cleanStimulus = Array.isArray(cfg.customStimulusItems)
          ? cfg.customStimulusItems.map((item, idx) => {
              const entry: Record<string, any> = {
                id: String(item?.id || `stim-${idx + 1}`),
                name: String(item?.name || ''),
                amount: Number(item?.amount) || 0,
                enabled: item?.enabled !== false,
              };
              if (item?.maxLimit !== undefined && item?.maxLimit !== null && Number(item.maxLimit) > 0) {
                entry.maxLimit = Number(item.maxLimit);
              }
              return entry;
            })
          : [];
        sanitizedTaxMap[Number(yrKey)] = {
          ...cfg,
          disabledCareCount: Number(cfg.disabledCareCount) || 0,
          prenatalAndChildbirthExpense: Number(cfg.prenatalAndChildbirthExpense) || 0,
          pensionInsurance: Number(cfg.pensionInsurance) || 0,
          easyEReceipt: Number(cfg.easyEReceipt) || 0,
          customStimulusItems: cleanStimulus,
        };
      });
      cleanPayload.yearlyTaxDeductions = sanitizedTaxMap;
    }

    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch Settings from Firestore (One-time backup)
export async function fetchUserSettings(userId: string): Promise<PayrollSettings | null> {
  const path = `users/${userId}/settings/current`;
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'current');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as PayrollSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// Save single cycle directly and reliably to Firestore
export async function saveUserCycle(
  userId: string, 
  cycleKey: string, 
  records: DailyRecord[], 
  taxPaid?: number
): Promise<{ success: boolean; cycleKey: string; count: number }> {
  const path = `users/${userId}/cycles/${cycleKey}`;
  try {
    const docRef = doc(db, 'users', userId, 'cycles', cycleKey);

    // Sanitize records ensuring exact data fidelity
    const cleanRecords = records.map((r) => ({
      id: String(r.id),
      date: String(r.date),
      dayOfWeek: String(r.dayOfWeek),
      dayNumber: Number(r.dayNumber),
      shiftType: r.shiftType,
      shiftPeriod: r.shiftPeriod || 'DAY',
      isSaturdayOff: Boolean(r.isSaturdayOff),
      isBeforeWorkStart: Boolean(r.isBeforeWorkStart),
      holidayName: r.holidayName || '',
      ot1_0: Number(r.ot1_0) || 0,
      ot1_5: Number(r.ot1_5) || 0,
      ot2_0: Number(r.ot2_0) || 0,
      ot3_0: Number(r.ot3_0) || 0,
      note: r.note || '',
      mealAllowance: Number(r.mealAllowance) || 0,
      shiftAllowanceDay: Number(r.shiftAllowanceDay) || 0,
    }));

    await setDoc(docRef, {
      userId,
      cycleKey,
      taxPaid: Number(taxPaid) || 0,
      records: cleanRecords,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true, cycleKey, count: cleanRecords.length };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Fetch all cycles from Firestore (One-time backup)
export async function fetchUserCycles(
  userId: string
): Promise<{ cycles: Record<string, DailyRecord[]>; cycleTaxes: Record<string, number> }> {
  const path = `users/${userId}/cycles`;
  try {
    const colRef = collection(db, 'users', userId, 'cycles');
    const snapshot = await getDocs(colRef);
    const cycles: Record<string, DailyRecord[]> = {};
    const cycleTaxes: Record<string, number> = {};

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const cKey = data.cycleKey || docSnap.id;
      if (Array.isArray(data.records)) {
        cycles[cKey] = data.records;
      }
      if (typeof data.taxPaid === 'number') {
        cycleTaxes[cKey] = data.taxPaid;
      }
    });

    return { cycles, cycleTaxes };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return { cycles: {}, cycleTaxes: {} };
  }
}

// Save holidays list
export async function saveUserHolidays(userId: string, holidays: Holiday[]): Promise<void> {
  const path = `users/${userId}/holidays`;
  try {
    for (const h of holidays) {
      const docRef = doc(db, 'users', userId, 'holidays', h.id);
      await setDoc(docRef, {
        id: h.id,
        userId,
        date: h.date,
        name: h.name,
        type: h.type || 'COMPANY',
        isCustom: Boolean(h.isCustom),
        note: h.note || '',
        sourceYear: h.sourceYear !== undefined ? h.sourceYear : null,
        createdAt: h.createdAt || new Date().toISOString(),
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Bulk save holidays (e.g. copying an entire year of holidays)
export async function saveBulkHolidays(userId: string, holidaysToSave: Holiday[]): Promise<void> {
  if (!holidaysToSave || holidaysToSave.length === 0) return;
  const path = `users/${userId}/holidays`;
  try {
    const batch = writeBatch(db);
    for (const h of holidaysToSave) {
      const docRef = doc(db, 'users', userId, 'holidays', h.id);
      batch.set(docRef, {
        id: h.id,
        userId,
        date: h.date,
        name: h.name,
        type: h.type || 'COMPANY',
        isCustom: Boolean(h.isCustom),
        note: h.note || '',
        sourceYear: h.sourceYear !== undefined ? h.sourceYear : null,
        createdAt: h.createdAt || new Date().toISOString(),
      }, { merge: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Delete holiday
export async function deleteUserHoliday(userId: string, holidayId: string): Promise<void> {
  const path = `users/${userId}/holidays/${holidayId}`;
  try {
    const docRef = doc(db, 'users', userId, 'holidays', holidayId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch holidays
export async function fetchUserHolidays(userId: string): Promise<Holiday[]> {
  const path = `users/${userId}/holidays`;
  try {
    const colRef = collection(db, 'users', userId, 'holidays');
    const snapshot = await getDocs(colRef);
    const holidays: Holiday[] = [];
    snapshot.docs.forEach((docSnap) => {
      holidays.push(docSnap.data() as Holiday);
    });
    return holidays;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Save Salary Increments
export async function saveUserSalaryIncrements(
  userId: string, 
  records: SalaryIncrementRecord[]
): Promise<void> {
  const path = `users/${userId}/salaryIncrements`;
  try {
    for (const r of records) {
      const docRef = doc(db, 'users', userId, 'salaryIncrements', r.id);
      await setDoc(docRef, {
        id: r.id,
        userId,
        tenureYear: Number(r.tenureYear) || 0,
        effectiveMonth: r.effectiveMonth || '',
        effectiveYear: Number(r.effectiveYear) || 2026,
        salaryBefore: Number(r.salaryBefore) || 0,
        increasePercent: Number(r.increasePercent) || 0,
        salaryAfter: Number(r.salaryAfter) || 0,
        increaseAmount: Number(r.increaseAmount) || 0,
        providentFundDeduction: Number(r.providentFundDeduction) || 0,
        note: r.note || '',
        createdAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete Salary Increment
export async function deleteUserSalaryIncrement(userId: string, recordId: string): Promise<void> {
  const path = `users/${userId}/salaryIncrements/${recordId}`;
  try {
    const docRef = doc(db, 'users', userId, 'salaryIncrements', recordId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch Salary Increments
export async function fetchUserSalaryIncrements(userId: string): Promise<SalaryIncrementRecord[]> {
  const path = `users/${userId}/salaryIncrements`;
  try {
    const colRef = collection(db, 'users', userId, 'salaryIncrements');
    const snapshot = await getDocs(colRef);
    const increments: SalaryIncrementRecord[] = [];
    snapshot.docs.forEach((docSnap) => {
      increments.push(docSnap.data() as SalaryIncrementRecord);
    });
    return increments;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Real-time listener: Pay Slip Attachments
export function subscribeUserPaySlips(
  userId: string,
  onUpdate: (paySlips: PaySlipAttachment[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = `users/${userId}/paySlips`;
  const colRef = collection(db, 'users', userId, 'paySlips');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const slips: PaySlipAttachment[] = [];
      snapshot.docs.forEach((docSnap) => {
        slips.push(docSnap.data() as PaySlipAttachment);
      });
      slips.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(slips);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (formattedErr) {
        if (onError) onError(formattedErr);
      }
    }
  );
}

// Save single Pay Slip Attachment to Firestore
export async function saveUserPaySlip(userId: string, slip: PaySlipAttachment): Promise<void> {
  const path = `users/${userId}/paySlips/${slip.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'paySlips', slip.id);
    const nowIso = new Date().toISOString();
    const cycleKey = String(slip.cycleKey || '').trim().slice(0, 10);
    const payPeriodLabel = String(slip.payPeriodLabel || cycleKey).trim().slice(0, 120);

    const cleanPayload: Record<string, any> = {
      id: String(slip.id).slice(0, 128),
      userId,
      cycleKey,
      payPeriodLabel,
      imageDataUrl: String(slip.imageDataUrl || ''),
      createdAt: String(slip.createdAt || nowIso).slice(0, 40),
    };

    if (slip.updatedAt && String(slip.updatedAt).trim() !== '') {
      cleanPayload.updatedAt = String(slip.updatedAt).trim().slice(0, 40);
    }
    if (slip.fileName && String(slip.fileName).trim() !== '') {
      cleanPayload.fileName = String(slip.fileName).trim().slice(0, 150);
    }
    if (slip.mimeType && String(slip.mimeType).trim() !== '') {
      cleanPayload.mimeType = String(slip.mimeType).trim().slice(0, 50);
    }
    if (typeof slip.fileSizeBytes === 'number' && Number.isFinite(slip.fileSizeBytes)) {
      cleanPayload.fileSizeBytes = Math.max(0, Math.floor(slip.fileSizeBytes));
    }
    if (typeof slip.downloadCount === 'number' && Number.isFinite(slip.downloadCount)) {
      cleanPayload.downloadCount = Math.max(0, Math.floor(slip.downloadCount));
    }
    if (slip.lastDownloadedAt && String(slip.lastDownloadedAt).trim() !== '') {
      cleanPayload.lastDownloadedAt = String(slip.lastDownloadedAt).trim().slice(0, 40);
    }

    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete Pay Slip Attachment
export async function deleteUserPaySlip(userId: string, slipId: string): Promise<void> {
  const path = `users/${userId}/paySlips/${slipId}`;
  try {
    const docRef = doc(db, 'users', userId, 'paySlips', slipId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch Pay Slips (One-time backup)
export async function fetchUserPaySlips(userId: string): Promise<PaySlipAttachment[]> {
  const path = `users/${userId}/paySlips`;
  try {
    const colRef = collection(db, 'users', userId, 'paySlips');
    const snapshot = await getDocs(colRef);
    const slips: PaySlipAttachment[] = [];
    snapshot.docs.forEach((docSnap) => {
      slips.push(docSnap.data() as PaySlipAttachment);
    });
    slips.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return slips;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
