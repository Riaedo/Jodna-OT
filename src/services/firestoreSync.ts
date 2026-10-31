import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, User } from '../firebase';
import { DailyRecord, Holiday, PayrollSettings, SalaryIncrementRecord } from '../types/overtime';

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

// Fetch Settings from Firestore
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

// Save single cycle records & tax to Firestore
export async function saveUserCycle(
  userId: string, 
  cycleKey: string, 
  records: DailyRecord[], 
  taxPaid?: number
): Promise<void> {
  const path = `users/${userId}/cycles/${cycleKey}`;
  try {
    const docRef = doc(db, 'users', userId, 'cycles', cycleKey);
    // Sanitize records to keep clean plain objects
    const cleanRecords = records.map(r => ({
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch all cycles from Firestore
export async function fetchUserCycles(
  userId: string
): Promise<{ cycles: Record<string, DailyRecord[]>; cycleTaxes: Record<string, number> }> {
  const path = `users/${userId}/cycles`;
  try {
    const colRef = collection(db, 'users', userId, 'cycles');
    const snapshot = await getDocs(colRef);
    const cycles: Record<string, DailyRecord[]> = {};
    const cycleTaxes: Record<string, number> = {};

    snapshot.docs.forEach(docSnap => {
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

// Save holidays list or individual
export async function saveUserHolidays(userId: string, holidays: Holiday[]): Promise<void> {
  const path = `users/${userId}/holidays`;
  try {
    // Write holidays
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

// Fetch holidays from Firestore
export async function fetchUserHolidays(userId: string): Promise<Holiday[]> {
  const path = `users/${userId}/holidays`;
  try {
    const colRef = collection(db, 'users', userId, 'holidays');
    const snapshot = await getDocs(colRef);
    const holidays: Holiday[] = [];
    snapshot.docs.forEach(docSnap => {
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
    snapshot.docs.forEach(docSnap => {
      increments.push(docSnap.data() as SalaryIncrementRecord);
    });
    return increments;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
