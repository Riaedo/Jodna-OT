import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, User } from '../firebase';
import { DailyRecord, Holiday, PayrollSettings, SalaryIncrementRecord } from '../types/overtime';

// Clear only keys starting with ot_app_ from LocalStorage
export function clearOtAppLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('ot_app_') || key.startsWith('gemini_supabase_'))) {
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

  // 6. Clear Local Storage for ot_app_ on this device
  clearOtAppLocalStorage();
  try {
    localStorage.setItem('ot_app_applied_reset_version', resetVersion);
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
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
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
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
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
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
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
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
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
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
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

// Save single cycle with smart merging & conflict protection
export async function saveUserCycle(
  userId: string, 
  cycleKey: string, 
  records: DailyRecord[], 
  taxPaid?: number
): Promise<{ merged: boolean; conflictDay?: number }> {
  const path = `users/${userId}/cycles/${cycleKey}`;
  try {
    const docRef = doc(db, 'users', userId, 'cycles', cycleKey);
    
    // Check if remote version exists to perform Day-Level Smart Merging
    let finalRecords = records;
    let hadConflict = false;

    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        const remoteData = existingSnap.data();
        if (Array.isArray(remoteData.records) && remoteData.records.length > 0) {
          const remoteMap = new Map<string, DailyRecord>();
          remoteData.records.forEach((r: DailyRecord) => remoteMap.set(r.date, r));

          // Merge local edits with remote changes
          finalRecords = records.map((locRecord) => {
            const rem = remoteMap.get(locRecord.date);
            if (!rem) return locRecord;

            // If local record is unedited default, but remote has OT, keep remote
            const localHasOt = (Number(locRecord.ot1_0) || 0) + (Number(locRecord.ot1_5) || 0) + (Number(locRecord.ot2_0) || 0) + (Number(locRecord.ot3_0) || 0) > 0 || locRecord.shiftType !== 'NORMAL';
            const remoteHasOt = (Number(rem.ot1_0) || 0) + (Number(rem.ot1_5) || 0) + (Number(rem.ot2_0) || 0) + (Number(rem.ot3_0) || 0) > 0 || rem.shiftType !== 'NORMAL';

            if (!localHasOt && remoteHasOt) {
              return rem;
            }
            return locRecord;
          });
        }
      }
    } catch (mergeErr) {
      console.warn('Smart merge check bypassed:', mergeErr);
    }

    // Sanitize records
    const cleanRecords = finalRecords.map((r) => ({
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

    return { merged: hadConflict };
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
        createdAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
