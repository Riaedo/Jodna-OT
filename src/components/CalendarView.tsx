import React, { useMemo } from 'react';
import { DailyRecord, PayrollSettings, PayrollSummary } from '../types/overtime';
import { formatCurrency } from '../utils/calculator';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';

interface CalendarViewProps {
  records: DailyRecord[];
  summary: PayrollSummary;
  settings: PayrollSettings;
  onSelectDate: (record: DailyRecord) => void;
  latestDate?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  records,
  summary,
  settings,
  onSelectDate,
  latestDate,
}) => {
  const hasWorkStartDate = Boolean(settings.workStartDate && settings.workStartDate.trim() !== '');

  const { leadingPadding, trailingPadding } = useMemo(() => {
    if (!hasWorkStartDate || !records || records.length === 0) {
      return { leadingPadding: 0, trailingPadding: 0 };
    }
    const startPad = new Date(records[0].date + 'T00:00:00').getDay();
    const trailingPad = (7 - ((startPad + records.length) % 7)) % 7;
    return { leadingPadding: startPad, trailingPadding: trailingPad };
  }, [records, hasWorkStartDate]);

  if (!hasWorkStartDate || !records || records.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto space-y-4 my-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <CalendarIcon className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
            ยังไม่ได้ระบุวันเริ่มทำงาน
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            ในส่วนปฏิทินและบันทึกเวลาจะคืนค่าเป็นว่างไว้ กรุณาระบุวันเริ่มทำงานในเมนู "ตั้งค่า" เพื่อเริ่มคำนวณและแสดงผล
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      
      {/* Calendar Header - Compact */}
      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50 dark:bg-slate-800/40">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
              ปฏิทินกะและบันทึกชั่วโมงโอที
            </h3>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              กะ {settings.shiftGroup}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            คลิกที่ช่องวันที่เพื่อบันทึกหรือแก้ไขชั่วโมง OT หรือลงบันทึกการลา
          </p>
        </div>

        {/* Calendar Legend */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[10px]">
          {settings.shiftWorkEnabled && (
            <>
              <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-semibold">
                🌞 Day
              </span>
              <span className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 font-semibold">
                🌙 Night
              </span>
            </>
          )}
          <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 1.5x
          </span>
          <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 1.0x
          </span>
          <span className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ป่วย (E)
          </span>
          <span className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> กิจ (D)
          </span>
          <span className="flex items-center gap-1 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> พักร้อน (J)
          </span>
          <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> หยุด (H)
          </span>
        </div>
      </div>

      {/* 3: Calendar Grid (จัดตำแหน่ง วัน-วันที่ ให้ตรงตามวันในสัปดาห์อย่างถูกต้อง) */}
      <div className="p-2 sm:p-4">
        {/* Day of Week Header on Mobile & Desktop */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold">
          <div className="text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 py-1 rounded-lg border border-rose-100 dark:border-rose-900/40">อา.</div>
          <div className="text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 py-1 rounded-lg">จ.</div>
          <div className="text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 py-1 rounded-lg">อ.</div>
          <div className="text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 py-1 rounded-lg">พ.</div>
          <div className="text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 py-1 rounded-lg">พฤ.</div>
          <div className="text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 py-1 rounded-lg">ศ.</div>
          <div className="text-purple-600 dark:text-purple-400 bg-purple-50/80 dark:bg-purple-950/40 py-1 rounded-lg border border-purple-100 dark:border-purple-900/40">ส.</div>
        </div>

        {/* 7-Column Grid with Alignment Padding */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Leading Empty Slots for proper Day-of-Week Alignment (อา. -> ส.) */}
          {leadingPadding > 0 && Array.from({ length: leadingPadding }).map((_, idx) => (
            <div
              key={`pad-start-${idx}`}
              className="min-h-[72px] sm:min-h-[84px] rounded-lg p-1 sm:p-1.5 border border-dashed border-slate-200/60 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20 pointer-events-none select-none flex items-center justify-center"
            >
              <span className="text-[10px] text-slate-300 dark:text-slate-700 font-mono">
                •
              </span>
            </div>
          ))}

          {records.map((r) => {
            const dateObj = new Date(r.date + 'T00:00:00');
            const dayOfWeekIdx = dateObj.getDay();
            const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
            const dowThai = thaiDays[dayOfWeekIdx];
            const thaiMonthAbbr = dateObj.toLocaleDateString('th-TH', { month: 'short' });

            const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
            const isHoliday = r.shiftType === 'H';
            const isSick = r.shiftType === 'E';
            const isPersonal = r.shiftType === 'D';
            const isVacation = r.shiftType === 'J';
            const isLeave = isSick || isPersonal || isVacation;

            const ot1_5 = Number(r.ot1_5) || 0;
            const ot1_0 = Number(r.ot1_0) || 0;
            const ot3_0 = Number(r.ot3_0) || 0;
            const totalDayHours = ot1_5 + ot1_0 + ot3_0;
            const isNight = r.shiftPeriod === 'NIGHT';
            
            const dayEarn = (ot1_5 * summary.ot1_5_rate) + (ot1_0 * summary.ot1_0_rate) + (ot3_0 * summary.ot3_0_rate);

            const isBeforeStart = Boolean(r.isBeforeWorkStart || (settings.workStartDate && r.date < settings.workStartDate));
            const isAfterLatest = Boolean(latestDate && r.date > latestDate);
            const isOutOfRange = isBeforeStart || isAfterLatest;

            return (
              <div
                key={r.id}
                onClick={() => {
                  if (!isOutOfRange) onSelectDate(r);
                }}
                className={`min-h-[72px] sm:min-h-[84px] rounded-lg p-1 sm:p-1.5 border transition-all duration-150 flex flex-col justify-between relative group ${
                  isOutOfRange
                    ? 'bg-slate-100/70 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800 opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 ' + (
                        totalDayHours > 0
                          ? 'bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                          : isSick
                          ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                          : isPersonal
                          ? 'bg-orange-50/60 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900'
                          : isVacation
                          ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900'
                          : isHoliday
                          ? 'bg-amber-50/50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600'
                      )
                }`}
              >
                {/* Card Top: Day Number (วันที่) & Day of Week (วัน) & Shift Badge */}
                <div className="flex items-start justify-between gap-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xs sm:text-sm font-black leading-none ${
                      isOutOfRange ? 'text-slate-400 dark:text-slate-500' : isSick ? 'text-rose-600 dark:text-rose-400' : isPersonal ? 'text-orange-600 dark:text-orange-400' : isVacation ? 'text-teal-600 dark:text-teal-400' : isHoliday ? 'text-amber-700 dark:text-amber-400' : isWeekend ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-100'
                    }`}>
                      {r.dayNumber}
                    </span>
                    <span className={`text-[8px] sm:text-[9.5px] font-bold ${
                      dayOfWeekIdx === 0 ? 'text-rose-500' : dayOfWeekIdx === 6 ? 'text-purple-500' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {dowThai}
                    </span>
                    {r.dayNumber === 1 && (
                      <span className="text-[7px] sm:text-[7.5px] font-extrabold px-1 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 leading-tight">
                        {thaiMonthAbbr}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5">
                    {isBeforeStart ? (
                      <span className="text-[7.5px] px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold border border-slate-300 dark:border-slate-700">
                        ก่อนเริ่มงาน
                      </span>
                    ) : isAfterLatest ? (
                      <span className="text-[7.5px] px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold">
                        -
                      </span>
                    ) : (
                      <>
                        {settings.shiftWorkEnabled && (
                          <span className={`text-[8px] font-bold px-0.5 rounded leading-tight ${
                            isNight
                              ? 'bg-purple-900 text-purple-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          }`}>
                            {isNight ? '🌙' : '🌞'}
                          </span>
                        )}

                        {isHoliday && (
                          <span className="text-[8px] px-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800">
                            H
                          </span>
                        )}
                        {isSick && (
                          <span className="text-[8px] px-1 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800">
                            E
                          </span>
                        )}
                        {isPersonal && (
                          <span className="text-[8px] px-1 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 font-bold border border-orange-300 dark:border-orange-800">
                            D
                          </span>
                        )}
                        {isVacation && (
                          <span className="text-[8px] px-1 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-800">
                            J
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Card Middle: Overtime Indicator */}
                <div className="my-0.5">
                  {isBeforeStart ? (
                    <div className="text-[8px] text-slate-400 dark:text-slate-500 text-center py-0.5 truncate font-medium">
                      ก่อนวันเริ่มงาน
                    </div>
                  ) : totalDayHours > 0 ? (
                    <div className="space-y-0.5">
                      {ot1_5 > 0 && (
                        <div className="text-[7.5px] sm:text-[9px] font-bold px-0.5 sm:px-1 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                          <span>1.5x</span>
                          <span>{ot1_5}h</span>
                        </div>
                      )}
                      {ot1_0 > 0 && (
                        <div className="text-[7.5px] sm:text-[9px] font-bold px-0.5 sm:px-1 rounded bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 flex items-center justify-between">
                          <span>1.0x</span>
                          <span>{ot1_0}h</span>
                        </div>
                      )}
                      {ot3_0 > 0 && (
                        <div className="text-[7.5px] sm:text-[9px] font-bold px-0.5 sm:px-1 rounded bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 flex items-center justify-between">
                          <span>3.0x</span>
                          <span>{ot3_0}h</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[8.5px] sm:text-[9px] text-slate-300 dark:text-slate-600 text-center py-0.5 group-hover:text-indigo-500 font-medium truncate">
                      {r.holidayName ? r.holidayName.slice(0, 5) : isLeave ? (isSick ? 'ป่วย' : isPersonal ? 'กิจ' : 'พักร้อน') : '+ OT'}
                    </div>
                  )}
                </div>

                {/* Card Bottom: Earn Amount */}
                <div className="pt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[7.5px] sm:text-[9px]">
                  {isBeforeStart ? (
                    <span className="text-slate-400 dark:text-slate-600 truncate">
                      ยังไม่เริ่มงาน
                    </span>
                  ) : dayEarn > 0 ? (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate">
                      +฿{dayEarn >= 1000 ? Math.round(dayEarn) : formatCurrency(dayEarn)}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 truncate">
                      {r.shiftType === 'NORMAL' ? 'ปกติ' : '-'}
                    </span>
                  )}

                  {!isBeforeStart && (
                    <span className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 shrink-0">
                      <Plus className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                    </span>
                  )}
                </div>

              </div>
            );
          })}

          {/* Trailing Empty Slots to complete the grid */}
          {trailingPadding > 0 && Array.from({ length: trailingPadding }).map((_, idx) => (
            <div
              key={`pad-end-${idx}`}
              className="min-h-[72px] sm:min-h-[84px] rounded-lg p-1 sm:p-1.5 border border-dashed border-slate-200/60 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20 pointer-events-none select-none flex items-center justify-center"
            >
              <span className="text-[10px] text-slate-300 dark:text-slate-700 font-mono">
                •
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
