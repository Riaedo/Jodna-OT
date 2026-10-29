import React, { useState, useMemo } from 'react';
import { DailyRecord, PayrollSettings, PayrollSummary } from '../types/overtime';
import { formatCurrency } from '../utils/calculator';
import { 
  FileSpreadsheet, 
  Lock, 
  Calendar, 
  Columns, 
  List, 
  Table as TableIcon 
} from 'lucide-react';

interface TimesheetTableProps {
  records: DailyRecord[];
  summary: PayrollSummary;
  settings: PayrollSettings;
  onGoToCalendar?: () => void;
  latestDate?: string;
}

export const TimesheetTable: React.FC<TimesheetTableProps> = ({
  records,
  summary,
  settings,
  onGoToCalendar,
  latestDate,
}) => {
  // 4: Default to 'single-page' (ดูได้ในหน้าเดียวไม่ให้มีแถบเลื่อน)
  const [viewMode, setViewMode] = useState<'single-page' | 'list' | 'matrix'>('single-page');

  const hasWorkStartDate = Boolean(settings.workStartDate && settings.workStartDate.trim() !== '');

  // 3. วันที่ต่างๆ ให้เริ่มแสดงจากวันที่เริ่มทำงาน และแสดงจนถึงวันที่ล่าสุดเท่านั้น
  const displayRecords = useMemo(() => {
    if (!hasWorkStartDate) return [];
    return records.filter((r) => {
      if (r.date < settings.workStartDate!) return false;
      if (latestDate && r.date > latestDate) return false;
      return true;
    });
  }, [records, settings.workStartDate, latestDate, hasWorkStartDate]);

  const getShiftBadge = (record: DailyRecord) => {
    if (record.isBeforeWorkStart) {
      return { label: 'ก่อนเริ่มงาน', desc: 'ก่อนวันเริ่มทำงาน', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 font-medium' };
    }
    if (record.holidayName && record.shiftType === 'H') {
      return { label: 'H*', desc: record.holidayName, bg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold' };
    }
    switch (record.shiftType) {
      case 'H':
        return { label: 'H', desc: 'หยุด', bg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700' };
      case 'E':
        return { label: 'E', desc: 'ป่วย', bg: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold' };
      case 'D':
        return { label: 'D', desc: 'กิจ', bg: 'bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700 font-bold' };
      case 'J':
        return { label: 'J', desc: 'พักร้อน', bg: 'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700 font-bold' };
      default:
        return { label: 'ปกติ', desc: 'ปกติ', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  // If no work start date is specified, return empty notice
  if (!hasWorkStartDate) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto space-y-4 my-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <Calendar className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
            ยังไม่ได้ระบุวันเริ่มทำงาน
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            ในส่วนวันที่และตารางรอบเดือนจะคืนค่าเป็นว่างไว้ กรุณาระบุวันเริ่มทำงานในเมนู "ตั้งค่า" เพื่อเริ่มคำนวณและแสดงผล
          </p>
        </div>
      </div>
    );
  }

  // Split records into 2 equal halves for the single-page view on PC
  const halfIndex = Math.ceil(displayRecords.length / 2);
  const leftHalf = displayRecords.slice(0, halfIndex);
  const rightHalf = displayRecords.slice(halfIndex);

  // Helper row renderer for single page
  const renderSinglePageRow = (r: DailyRecord) => {
    const isWeekend = r.dayOfWeek === 'Sun' || r.dayOfWeek === 'Sat';
    const badge = getShiftBadge(r);
    const ot1_0 = Number(r.ot1_0) || 0;
    const ot1_5 = Number(r.ot1_5) || 0;
    const ot3_0 = Number(r.ot3_0) || 0;
    const totalDayHours = ot1_0 + ot1_5 + ot3_0;
    const dayEarnings = 
      (ot1_0 * summary.ot1_0_rate) +
      (ot1_5 * summary.ot1_5_rate) +
      (ot3_0 * summary.ot3_0_rate);

    const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const dayIdx = new Date(r.date + 'T00:00:00').getDay();
    const dowThai = thaiDays[dayIdx];

    return (
      <tr 
        key={r.id} 
        className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-colors border-b border-slate-100 dark:border-slate-800/80 text-[11px]"
      >
        <td className="py-1 px-1.5 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
          <span className={`inline-block min-w-[20px] ${
            isWeekend ? 'text-amber-600 dark:text-amber-400' : ''
          }`}>
            {r.dayNumber}
          </span>
          <span className={`text-[10px] font-semibold ml-1 ${
            dayIdx === 0 ? 'text-rose-500' : dayIdx === 6 ? 'text-purple-500' : 'text-slate-400 dark:text-slate-500'
          }`}>
            ({dowThai})
          </span>
        </td>

        <td className="py-1 px-1 text-center whitespace-nowrap">
          {settings.shiftWorkEnabled && (
            <span className={`px-1 py-0.2 rounded text-[9px] font-bold mr-1 ${
              r.shiftPeriod === 'NIGHT'
                ? 'bg-purple-900 text-purple-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {r.shiftPeriod === 'NIGHT' ? '🌙' : '🌞'}
            </span>
          )}
          <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${badge.bg}`}>
            {badge.label}
          </span>
        </td>

        <td className={`py-1 px-1 text-center font-bold ${ot1_0 > 0 ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40 rounded' : 'text-slate-300 dark:text-slate-700'}`}>
          {ot1_0 > 0 ? ot1_0 : '-'}
        </td>
        <td className={`py-1 px-1 text-center font-bold ${ot1_5 > 0 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 rounded' : 'text-slate-300 dark:text-slate-700'}`}>
          {ot1_5 > 0 ? ot1_5 : '-'}
        </td>
        <td className={`py-1 px-1 text-center font-bold ${ot3_0 > 0 ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/40 rounded' : 'text-slate-300 dark:text-slate-700'}`}>
          {ot3_0 > 0 ? ot3_0 : '-'}
        </td>

        <td className="py-1 px-1 text-center font-black text-slate-800 dark:text-slate-100">
          {totalDayHours > 0 ? `${totalDayHours}` : '-'}
        </td>

        <td className="py-1 px-1.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
          {dayEarnings > 0 ? `฿${formatCurrency(dayEarnings)}` : '-'}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      
      {/* Table Header Controls */}
      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50 dark:bg-slate-800/40">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
              ตารางบันทึกเวลาทำงานล่วงเวลา (Timesheet)
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              แสดงผล (แก้ไขที่ปฏิทินกะ)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            ข้อมูลรอบวิก 30 วัน • ปรับให้ดูครบถ้วนในหน้าเดียวโดยไม่มีแถบเลื่อน
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onGoToCalendar && (
            <button
              onClick={onGoToCalendar}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>ปฏิทินกะ</span>
            </button>
          )}

          <div className="bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setViewMode('single-page')}
              title="ดูครบ 30 วันในหน้าเดียวแบบแบ่ง 2 ฝั่ง พอดีจอ ไม่ต้องเลื่อน"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                viewMode === 'single-page' 
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>หน้าเดียว (พอดีจอ)</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="ดูรายการเรียงลงมาทีละวัน"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>รายการยาว</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4: SINGLE PAGE VIEW (ดูได้ในหน้าเดียว ไม่ให้มีแถบเลื่อน) */}
      {viewMode === 'single-page' && (
        <div className="p-2 sm:p-3">
          
          {/* Desktop/Tablet: Split 2 columns side-by-side (15 days left + 15 days right) */}
          <div className="hidden md:grid md:grid-cols-2 gap-3">
            
            {/* Left Column Table: Days 1 to 15 */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/70">
              <div className="bg-slate-800 dark:bg-slate-950 text-white px-2.5 py-1 text-[11px] font-bold flex items-center justify-between border-b border-slate-700">
                <span>ช่วงที่ 1 (วันที่ {leftHalf[0]?.dayNumber} - {leftHalf[leftHalf.length - 1]?.dayNumber})</span>
                <span className="text-slate-400 font-normal">{leftHalf.length} วัน</span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-1 px-1.5">วันที่ / วัน</th>
                    <th className="py-1 px-1 text-center">กะ/สถานะ</th>
                    <th className="py-1 px-1 text-center">1.0x</th>
                    <th className="py-1 px-1 text-center">1.5x</th>
                    <th className="py-1 px-1 text-center">3.0x</th>
                    <th className="py-1 px-1 text-center">รวม ชม.</th>
                    <th className="py-1 px-1.5 text-right">ค่า OT</th>
                  </tr>
                </thead>
                <tbody>
                  {leftHalf.map(renderSinglePageRow)}
                </tbody>
              </table>
            </div>

            {/* Right Column Table: Days 16 to 30 */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/70">
              <div className="bg-slate-800 dark:bg-slate-950 text-white px-2.5 py-1 text-[11px] font-bold flex items-center justify-between border-b border-slate-700">
                <span>ช่วงที่ 2 (วันที่ {rightHalf[0]?.dayNumber} - {rightHalf[rightHalf.length - 1]?.dayNumber})</span>
                <span className="text-slate-400 font-normal">{rightHalf.length} วัน</span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-1 px-1.5">วันที่ / วัน</th>
                    <th className="py-1 px-1 text-center">กะ/สถานะ</th>
                    <th className="py-1 px-1 text-center">1.0x</th>
                    <th className="py-1 px-1 text-center">1.5x</th>
                    <th className="py-1 px-1 text-center">3.0x</th>
                    <th className="py-1 px-1 text-center">รวม ชม.</th>
                    <th className="py-1 px-1.5 text-right">ค่า OT</th>
                  </tr>
                </thead>
                <tbody>
                  {rightHalf.map(renderSinglePageRow)}
                </tbody>
              </table>
            </div>

          </div>

          {/* 6: Mobile Layout (Fit perfectly within 100% width, no horizontal scrollbar) */}
          <div className="md:hidden border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left table-fixed">
              <thead className="bg-slate-800 text-white text-[10px] font-bold">
                <tr>
                  <th className="py-1.5 px-2 w-[24%]">วันที่ / วัน</th>
                  <th className="py-1.5 px-1 text-center w-[20%]">กะ/สถานะ</th>
                  <th className="py-1.5 px-1 text-center w-[16%]">1.5x</th>
                  <th className="py-1.5 px-1 text-center w-[18%]">รวม ชม.</th>
                  <th className="py-1.5 px-1.5 text-right w-[22%]">ค่า OT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {displayRecords.map((r: DailyRecord) => {
                  const dayIdx = new Date(r.date + 'T00:00:00').getDay();
                  const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
                  const dowThai = thaiDays[dayIdx];
                  const isWeekend = dayIdx === 0 || dayIdx === 6;
                  const badge = getShiftBadge(r);
                  const ot1_0 = Number(r.ot1_0) || 0;
                  const ot1_5 = Number(r.ot1_5) || 0;
                  const ot3_0 = Number(r.ot3_0) || 0;
                  const totalDayHours = ot1_0 + ot1_5 + ot3_0;
                  const dayEarnings = 
                    (ot1_0 * summary.ot1_0_rate) +
                    (ot1_5 * summary.ot1_5_rate) +
                    (ot3_0 * summary.ot3_0_rate);

                  return (
                    <tr key={`mob-${r.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-1.5 px-2 font-bold text-slate-800 dark:text-slate-200">
                        <span>{r.dayNumber}</span>
                        <span className={`text-[10px] ml-1 font-semibold ${
                          dayIdx === 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : dayIdx === 6 ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-400'
                        }`}>
                          ({dowThai})
                        </span>
                      </td>

                      <td className="py-1.5 px-1 text-center">
                        <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {settings.shiftWorkEnabled && (
                          <span className="text-[9px] ml-0.5">
                            {r.shiftPeriod === 'NIGHT' ? '🌙' : '🌞'}
                          </span>
                        )}
                      </td>

                      <td className={`py-1.5 px-1 text-center font-bold ${ot1_5 > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'}`}>
                        {ot1_5 > 0 ? `${ot1_5}` : '-'}
                      </td>

                      <td className="py-1.5 px-1 text-center font-black text-slate-800 dark:text-slate-100">
                        {totalDayHours > 0 ? `${totalDayHours}h` : '-'}
                      </td>

                      <td className="py-1.5 px-1.5 text-right font-bold text-slate-900 dark:text-white truncate">
                        {dayEarnings > 0 ? `฿${formatCurrency(dayEarnings)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Consolidated Total Strip */}
          <div className="mt-2.5 p-2 rounded-xl bg-slate-900 dark:bg-slate-950 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">รอบ 30 วัน</span>
              <span>OT รวม: <strong className="text-emerald-400 text-sm">{summary.totalOtHours} ชม.</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <span>ยอดเงิน OT รวม: <strong className="text-emerald-300 text-sm">฿{formatCurrency(summary.totalOtAmount)}</strong></span>
            </div>
          </div>

        </div>
      )}

      {/* DETAILED LIST VIEW (Full Table) */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-2.5">วันที่</th>
                <th className="p-2.5">วัน</th>
                {settings.shiftWorkEnabled && <th className="p-2.5 text-center">กะ</th>}
                <th className="p-2.5">ประเภทกะ / การลา</th>
                <th className="p-2.5 text-center">OT 1.0x (ชม.)</th>
                <th className="p-2.5 text-center">OT 1.5x (ชม.)</th>
                <th className="p-2.5 text-center">OT 3.0x (ชม.)</th>
                <th className="p-2.5 text-center">รวม ชม.</th>
                <th className="p-2.5 text-right">ค่า OT (บาท)</th>
                <th className="p-2.5">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {displayRecords.map((r: DailyRecord) => {
                const badge = getShiftBadge(r);
                const dayTotalHours = (Number(r.ot1_0) || 0) + (Number(r.ot1_5) || 0) + (Number(r.ot3_0) || 0);
                const dayEarnings = 
                  ((Number(r.ot1_0) || 0) * summary.ot1_0_rate) +
                  ((Number(r.ot1_5) || 0) * summary.ot1_5_rate) +
                  ((Number(r.ot3_0) || 0) * summary.ot3_0_rate);

                return (
                  <tr 
                    key={r.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                      {r.date}
                    </td>
                    <td className="p-2.5 font-medium text-slate-600 dark:text-slate-400">
                      {(() => {
                        const dayIdx = new Date(r.date + 'T00:00:00').getDay();
                        const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
                        const dowThai = thaiDays[dayIdx];
                        return (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            dayIdx === 0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : dayIdx === 6 ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {dowThai}
                          </span>
                        );
                      })()}
                    </td>
                    {settings.shiftWorkEnabled && (
                      <td className="p-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.shiftPeriod === 'NIGHT'
                            ? 'bg-purple-900 text-purple-200 border border-purple-700'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {r.shiftPeriod === 'NIGHT' ? '🌙 Night' : '🌞 Day'}
                        </span>
                      </td>
                    )}
                    <td className="p-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}>
                        {badge.desc}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-blue-700 dark:text-blue-400">
                      {r.ot1_0 > 0 ? r.ot1_0 : '-'}
                    </td>
                    <td className="p-2.5 text-center font-bold text-emerald-700 dark:text-emerald-400">
                      {r.ot1_5 > 0 ? r.ot1_5 : '-'}
                    </td>
                    <td className="p-2.5 text-center font-bold text-purple-700 dark:text-purple-400">
                      {r.ot3_0 > 0 ? r.ot3_0 : '-'}
                    </td>
                    <td className="p-2.5 text-center font-black text-slate-800 dark:text-slate-100">
                      {dayTotalHours > 0 ? `${dayTotalHours} ชม.` : '-'}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                      {dayEarnings > 0 ? `฿${formatCurrency(dayEarnings)}` : '-'}
                    </td>
                    <td className="p-2.5 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {r.note || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
