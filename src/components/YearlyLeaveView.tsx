import React, { useState, useMemo } from 'react';
import { DailyRecord, PayrollSettings } from '../types/overtime';
import { getVacationQuotaForYear } from '../utils/calculator';
import { 
  Calendar, 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  HeartPulse, 
  Briefcase, 
  Palmtree, 
  CheckCircle2, 
  Check
} from 'lucide-react';

interface YearlyLeaveViewProps {
  allCycleRecords: Record<string, DailyRecord[]>;
  settings: PayrollSettings;
  onSelectRecordForEdit?: (record: DailyRecord) => void;
  minYear?: number;
  maxYear?: number;
}

export const YearlyLeaveView: React.FC<YearlyLeaveViewProps> = ({
  allCycleRecords,
  settings,
  minYear,
  maxYear,
}) => {
  const hasWorkStartDate = Boolean(settings.workStartDate && settings.workStartDate.trim() !== '');

  // Default year to maxYear (or current base 2026)
  const initialYear = useMemo(() => {
    if (maxYear !== undefined) return maxYear;
    return 2026;
  }, [maxYear]);

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'E' | 'D' | 'J'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // If selectedYear is outside [minYear, maxYear], auto-adjust
  React.useEffect(() => {
    if (minYear !== undefined && selectedYear < minYear) {
      setSelectedYear(minYear);
    } else if (maxYear !== undefined && selectedYear > maxYear) {
      setSelectedYear(maxYear);
    }
  }, [minYear, maxYear, selectedYear]);

  // If workStartDate is not specified, return blank/prompt as requested
  if (!hasWorkStartDate) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto space-y-4 my-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <CalendarDays className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
            ยังไม่ได้ระบุวันเริ่มทำงาน
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            ในส่วนรอบปีและสถิติวันลาจะคืนค่าเป็นว่างไว้ กรุณาระบุวันเริ่มทำงานในเมนู "ตั้งค่า" เพื่อเริ่มคำนวณและแสดงผลรอบปี
          </p>
        </div>
      </div>
    );
  }

  // Collect all leave records for the selected leave year cycle
  const leaveRecords = useMemo(() => {
    const list: DailyRecord[] = [];
    const seenDates = new Set<string>();

    const startM = settings.leaveYearStartMonth || 1;
    const startD = settings.cycleStartDay || settings.leaveYearStartDay || 20;

    const startMStr = String(startM).padStart(2, '0');
    const startDStr = String(startD).padStart(2, '0');
    const cycleStartDate = `${selectedYear}-${startMStr}-${startDStr}`;
    const nextY = selectedYear + 1;
    const cycleEndDate = `${nextY}-${startMStr}-${startDStr}`;

    Object.values(allCycleRecords).forEach((recordsArray) => {
      recordsArray.forEach((r) => {
        if (
          (r.shiftType === 'E' || r.shiftType === 'D' || r.shiftType === 'J') &&
          r.date >= cycleStartDate &&
          r.date < cycleEndDate &&
          !seenDates.has(r.date)
        ) {
          seenDates.add(r.date);
          list.push(r);
        }
      });
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [allCycleRecords, selectedYear, settings.leaveYearStartMonth, settings.cycleStartDay, settings.leaveYearStartDay]);

  // Counts for selected year
  const sickLeaveCount = leaveRecords.filter((r) => r.shiftType === 'E').length;
  const personalLeaveCount = leaveRecords.filter((r) => r.shiftType === 'D').length;
  const vacationLeaveCount = leaveRecords.filter((r) => r.shiftType === 'J').length;
  const totalLeaveCount = leaveRecords.length;

  const sickQuota = settings.leaveSickQuota || 30;
  const personalQuota = settings.leavePersonalQuota || 6;

  // Vacation Quota for the selected year
  const currentYearVacation = useMemo(() => {
    return getVacationQuotaForYear(
      selectedYear,
      settings.yearlyVacationQuotas,
      settings.leaveVacationQuota || 8
    );
  }, [selectedYear, settings.yearlyVacationQuotas, settings.leaveVacationQuota]);

  const vacationQuota = currentYearVacation.totalQuota;

  // Filtered list of leave items
  const filteredList = leaveRecords.filter((r) => {
    const matchType = typeFilter === 'ALL' || r.shiftType === typeFilter;
    const matchSearch =
      r.date.includes(searchTerm) ||
      (r.note && r.note.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchType && matchSearch;
  });

  const getLeaveTypeDetails = (type: string) => {
    switch (type) {
      case 'E':
        return { label: 'ลาป่วย (E)', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800' };
      case 'D':
        return { label: 'ลากิจ (D)', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300 dark:border-orange-800' };
      case 'J':
        return { label: 'ลาพักร้อน (J)', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800' };
      default:
        return { label: type, badge: 'bg-slate-100 text-slate-800' };
    }
  };

  const isPrevDisabled = minYear !== undefined && selectedYear <= minYear;
  const isNextDisabled = maxYear !== undefined && selectedYear >= maxYear;

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 dark:border-slate-300 animate-in slide-in-from-bottom duration-300">
          <Check className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 rounded-3xl p-5 sm:p-6 border border-indigo-500/20 shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
              <CalendarDays className="w-5 h-5" />
            </span>
            <span className="text-xs uppercase tracking-wider font-bold text-indigo-300">
              สถิติและบันทึกการลาทั้งปี (Yearly Leave Summary)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
            บันทึกการลารวมประจำปี ค.ศ. {selectedYear}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            สรุปประวัติวันลาป่วย (E), ลากิจ (D), และลาพักร้อน (J) ประจำรอบปี
          </p>
        </div>

        {/* Year Navigator (Bounded between minYear and maxYear) */}
        <div className="flex items-center bg-slate-800/90 border border-indigo-500/30 rounded-2xl p-1.5 self-start md:self-center">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            disabled={isPrevDisabled}
            className={`p-1.5 rounded-xl transition-colors ${
              isPrevDisabled 
                ? 'text-slate-600 opacity-40 cursor-not-allowed' 
                : 'hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isPrevDisabled ? 'ถึงปีก่อนหน้าสุดแล้ว' : 'ปีก่อนหน้า'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 text-center">
            <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">
              รอบปีที่เลือก
            </span>
            <span className="text-base font-extrabold text-white">
              ปี ค.ศ. {selectedYear}
            </span>
          </div>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            disabled={isNextDisabled}
            className={`p-1.5 rounded-xl transition-colors ${
              isNextDisabled 
                ? 'text-slate-600 opacity-40 cursor-not-allowed' 
                : 'hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isNextDisabled ? 'ถึงปีล่าสุดแล้ว' : 'ปีถัดไป'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Sick Leave (E) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                ลาป่วย (E)
              </span>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <HeartPulse className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {sickLeaveCount}
                </span>
                <span className="text-xs text-slate-400">
                  / {sickQuota} วัน (สิทธิ์คงเหลือ {Math.max(0, sickQuota - sickLeaveCount)} วัน)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div 
                  style={{ width: `${Math.min(100, (sickLeaveCount / (sickQuota || 1)) * 100)}%` }}
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            เกณฑ์ลาป่วยตามกฎหมายแรงงาน (ไม่หักเงินเดือน)
          </div>
        </div>

        {/* Card 2: Personal Leave (D) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                ลากิจ (D)
              </span>
              <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {personalLeaveCount}
                </span>
                <span className="text-xs text-slate-400">
                  / {personalQuota} วัน (สิทธิ์คงเหลือ {Math.max(0, personalQuota - personalLeaveCount)} วัน)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div 
                  style={{ width: `${Math.min(100, (personalLeaveCount / (personalQuota || 1)) * 100)}%` }}
                  className="bg-orange-500 h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            โควต้าลากิจประจำรอบปี
          </div>
        </div>

        {/* Card 3: Vacation Leave (J) - Clean Summary Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  ลาพักร้อน (J)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  ปี {selectedYear}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                <Palmtree className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {vacationLeaveCount}
                </span>
                <span className="text-xs text-slate-400">
                  / {vacationQuota} วัน
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span>
                  คงเหลือ: <strong className="text-teal-600 dark:text-teal-400 font-bold">{Math.max(0, vacationQuota - vacationLeaveCount)} วัน</strong>
                </span>
                {currentYearVacation.carriedOver > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    (ยกยอด +{currentYearVacation.carriedOver} วัน)
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2.5">
                <div 
                  style={{ width: `${Math.min(100, (vacationLeaveCount / (vacationQuota || 1)) * 100)}%` }}
                  className="bg-teal-500 h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            โควต้าลาพักร้อนประจำรอบปี
          </div>
        </div>

        {/* Card 4: Total Leaves */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                รวมวันลาทั้งหมดในปีนี้
              </span>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {totalLeaveCount}
                </span>
                <span className="text-xs text-slate-400">
                  วัน (จากทุกประเภทการลา)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                ป่วย {sickLeaveCount} • กิจ {personalLeaveCount} • พักร้อน {vacationLeaveCount}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            รอบปีตัดทุกวันที่ {settings.cycleStartDay} ของเดือน {settings.leaveYearStartMonth || 1}
          </div>
        </div>

      </div>

      {/* Filter and Search Bar for Leave Records */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`ค้นหาวันที่ลา หรือ หมายเหตุของปี ${selectedYear}...`}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Leave Type Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${
              typeFilter === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            ทั้งหมด ({totalLeaveCount})
          </button>
          <button
            onClick={() => setTypeFilter('E')}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${
              typeFilter === 'E'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            ลาป่วย ({sickLeaveCount})
          </button>
          <button
            onClick={() => setTypeFilter('D')}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${
              typeFilter === 'D'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            ลากิจ ({personalLeaveCount})
          </button>
          <button
            onClick={() => setTypeFilter('J')}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${
              typeFilter === 'J'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            พักร้อน ({vacationLeaveCount})
          </button>
        </div>
      </div>

      {/* Leave Records List - Mobile Cards View (md:hidden) */}
      <div className="block md:hidden space-y-2.5">
        {filteredList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center text-slate-400 border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
            <p className="text-sm font-semibold">ไม่มีรายการบันทึกการลาตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          filteredList.map((r) => {
            const details = getLeaveTypeDetails(r.shiftType);
            const d = new Date(r.date + 'T00:00:00');
            const dateThai = d.toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            });

            return (
              <div 
                key={r.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {dateThai}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({r.date})
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${details.badge}`}>
                    {details.label}
                  </span>
                </div>
                {r.note && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    {r.note}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Leave Records List - Desktop Table View (hidden md:block) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">วันที่ (Date)</th>
                <th className="p-3">วันในสัปดาห์</th>
                <th className="p-3">ประเภทการลา</th>
                <th className="p-3">กะทำงาน</th>
                <th className="p-3">หมายเหตุ / เหตุผลการลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="text-sm font-semibold">ไม่มีรายการบันทึกการลาตามเงื่อนไขที่เลือก</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((r) => {
                  const details = getLeaveTypeDetails(r.shiftType);
                  const d = new Date(r.date + 'T00:00:00');
                  const dateThai = d.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  });

                  return (
                    <tr 
                      key={r.id} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                        {dateThai} ({r.date})
                      </td>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">
                        {r.dayOfWeek}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${details.badge}`}>
                          {details.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {r.shiftPeriod === 'NIGHT' ? '🌙 กะดึก (Night)' : '🌞 กะเช้า (Day)'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {r.note || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
