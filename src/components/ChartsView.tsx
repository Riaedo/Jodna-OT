import React, { useState, useMemo } from 'react';
import { DailyRecord, PayrollSettings, PayrollSummary } from '../types/overtime';
import { formatCurrency } from '../utils/calculator';
import { 
  BarChart, 
  PieChart, 
  Sparkles, 
  Layers
} from 'lucide-react';

interface ChartsViewProps {
  records: DailyRecord[];
  summary: PayrollSummary;
  settings: PayrollSettings;
  onSelectDate: (record: DailyRecord) => void;
}

export const ChartsView: React.FC<ChartsViewProps> = ({
  records,
  summary,
  settings,
  onSelectDate,
}) => {
  const [hoveredRecord, setHoveredRecord] = useState<DailyRecord | null>(null);

  // Maximum OT in a single day for chart scaling
  const maxDailyOt = Math.max(
    ...records.map((r) => (Number(r.ot1_0) || 0) + (Number(r.ot1_5) || 0) + (Number(r.ot2_0) || 0) + (Number(r.ot3_0) || 0)),
    8 // fallback min scale
  );

  // Donut chart calculations
  const totalHours = summary.totalOtHours || 1;
  const p1_5 = (summary.totalOt1_5_hours / totalHours) * 100;
  const p1_0 = (summary.totalOt1_0_hours / totalHours) * 100;
  const p3_0 = (summary.totalOt3_0_hours / totalHours) * 100;

  // Donut SVG circumference calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  
  const stroke1_5 = (p1_5 / 100) * circumference;
  const stroke1_0 = (p1_0 / 100) * circumference;
  const stroke3_0 = (p3_0 / 100) * circumference;

  const offset1_5 = 0;
  const offset1_0 = -stroke1_5;
  const offset3_0 = -(stroke1_5 + stroke1_0);

  // Income proportions
  const gross = summary.totalGrossIncome || 1;
  const salaryPct = (settings.baseSalary / gross) * 100;
  const otPct = (summary.totalOtAmount / gross) * 100;
  const allowPct = ((summary.totalFixedAllowances + summary.diligenceAmount + summary.shiftAmount) / gross) * 100;

  // Find record with highest OT
  const topOtRecord = useMemo(() => {
    let top: DailyRecord | null = null;
    let topHours = 0;
    for (const r of records) {
      const h = (Number(r.ot1_0) || 0) + (Number(r.ot1_5) || 0) + (Number(r.ot2_0) || 0) + (Number(r.ot3_0) || 0);
      if (h > topHours) {
        topHours = h;
        top = r;
      }
    }
    return top;
  }, [records]);

  const topOtHours = topOtRecord
    ? (Number(topOtRecord.ot1_0) || 0) + (Number(topOtRecord.ot1_5) || 0) + (Number(topOtRecord.ot2_0) || 0) + (Number(topOtRecord.ot3_0) || 0)
    : 0;

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Quick Summary & Insight */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 rounded-2xl p-5 border border-indigo-500/20 shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              ภาพรวมชั่วโมงทำงานล่วงเวลาประจำงวด
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                Active Cycle
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              คุณสะสมชั่วโมง OT ทั้งหมด <span className="font-bold text-emerald-400">{summary.totalOtHours} ชั่วโมง</span> คิดเป็น 
              <span className="font-bold text-amber-300"> +฿{formatCurrency(summary.totalOtAmount)}</span> หรือประมาณ 
              <span className="font-bold text-indigo-300"> {otPct.toFixed(1)}%</span> ของรายได้รวมทั้งหมดในงวดนี้
            </p>
          </div>
        </div>

        {topOtRecord && (
          <div className="bg-slate-800/90 border border-indigo-500/30 rounded-xl p-3 text-right self-stretch md:self-auto min-w-[200px]">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
              วันที่ทำ OT สูงสุด
            </span>
            <span className="text-sm font-bold text-amber-400 block mt-0.5">
              วันที่ {topOtRecord.dayNumber} ({topOtRecord.dayOfWeek})
            </span>
            <span className="text-xs text-slate-300">
              รวม {topOtHours} ชม. (+฿{formatCurrency(
                (topOtRecord.ot1_0 * summary.ot1_0_rate) +
                (topOtRecord.ot1_5 * summary.ot1_5_rate) +
                (topOtRecord.ot3_0 * summary.ot3_0_rate)
              )})
            </span>
          </div>
        )}
      </div>

      {/* Main Charts Grid: Daily Bar Timeline + Donut Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Daily OT Timeline Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <BarChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  กราฟแท่งบันทึก OT รายวัน (ตลอดรอบตัดวิก)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  คลิกที่แท่งกราฟวันใดๆ เพื่อดูหรือแก้ไขชั่วโมง OT
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">OT 1.5x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-500"></span>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">OT 1.0x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-purple-500"></span>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">OT 3.0x</span>
                </div>
              </div>
            </div>

            {/* Interactive Bar Chart Area */}
            <div className="mt-6 relative">
              <div className="overflow-x-auto pb-4 pt-6 scrollbar-thin">
                <div className="flex items-end gap-1.5 sm:gap-2 min-w-[700px] h-48 border-b border-slate-200 dark:border-slate-700 px-2">
                  {records.map((r) => {
                    const ot1_5 = Number(r.ot1_5) || 0;
                    const ot1_0 = Number(r.ot1_0) || 0;
                    const ot3_0 = Number(r.ot3_0) || 0;
                    const dayTotal = ot1_5 + ot1_0 + ot3_0;
                    
                    const isHoliday = r.shiftType === 'H';
                    const isLeave = r.shiftType === 'E' || r.shiftType === 'D';
                    
                    const heightPct = dayTotal > 0 ? Math.min(100, (dayTotal / maxDailyOt) * 100) : 4;
                    const dayEarnings = (ot1_5 * summary.ot1_5_rate) + (ot1_0 * summary.ot1_0_rate) + (ot3_0 * summary.ot3_0_rate);

                    return (
                      <div
                        key={r.id}
                        onClick={() => onSelectDate(r)}
                        onMouseEnter={() => setHoveredRecord(r)}
                        onMouseLeave={() => setHoveredRecord(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group relative"
                      >
                        {dayTotal > 0 && (
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {dayTotal}h
                          </span>
                        )}

                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[20px] rounded-t-md transition-all duration-200 relative overflow-hidden flex flex-col-reverse shadow-sm ${
                            dayTotal === 0
                              ? isLeave
                                ? 'bg-rose-200 dark:bg-rose-950 border border-rose-300 dark:border-rose-800'
                                : isHoliday
                                ? 'bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800'
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                              : 'group-hover:scale-105 group-hover:brightness-110'
                          }`}
                        >
                          {ot1_5 > 0 && (
                            <div
                              style={{ height: `${(ot1_5 / dayTotal) * 100}%` }}
                              className="w-full bg-emerald-500"
                              title={`OT 1.5x: ${ot1_5} ชม.`}
                            />
                          )}
                          {ot1_0 > 0 && (
                            <div
                              style={{ height: `${(ot1_0 / dayTotal) * 100}%` }}
                              className="w-full bg-blue-500"
                              title={`OT 1.0x: ${ot1_0} ชม.`}
                            />
                          )}
                          {ot3_0 > 0 && (
                            <div
                              style={{ height: `${(ot3_0 / dayTotal) * 100}%` }}
                              className="w-full bg-purple-500"
                              title={`OT 3.0x: ${ot3_0} ชม.`}
                            />
                          )}
                        </div>

                        <div className="mt-2 text-center">
                          <span className={`text-[11px] font-bold block ${
                            isLeave ? 'text-rose-600 dark:text-rose-400' : isHoliday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {r.dayNumber}
                          </span>
                          <span className="text-[9px] text-slate-400 block uppercase">
                            {r.dayOfWeek.slice(0, 1)}
                          </span>
                        </div>

                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col z-20 bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap min-w-[120px]">
                          <span className="font-bold text-amber-300">
                            วันที่ {r.dayNumber} ({r.dayOfWeek})
                          </span>
                          <span className="text-slate-300 text-[10px]">
                            สถานะ: {r.shiftType === 'H' ? 'วันหยุด (H)' : r.shiftType === 'E' ? 'ลากิจ/ป่วย (E)' : 'วันทำงาน'}
                          </span>
                          {dayTotal > 0 ? (
                            <>
                              <span className="text-emerald-400 font-semibold mt-0.5">
                                รวม OT: {dayTotal} ชม.
                              </span>
                              <span className="text-indigo-300 font-bold">
                                +฿{formatCurrency(dayEarnings)}
                              </span>
                              {r.note && <span className="text-slate-400 text-[9px] mt-0.5 max-w-[130px] truncate">{r.note}</span>}
                            </>
                          ) : (
                            <span className="text-slate-400">ไม่มีบันทึก OT</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              วันลา (E, D): {summary.leaveDaysCount} วัน
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              วันหยุด (H): {summary.holidayCount} วัน
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              วันทำงานปกติ: {summary.workDaysCount} วัน
            </span>
          </div>
        </div>

        {/* Chart 2: OT Multiplier Donut Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-colors">
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              สัดส่วนประเภทล่วงเวลา (OT Share)
            </h4>

            {/* Donut SVG */}
            <div className="flex flex-col items-center justify-center my-6 relative">
              <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="#e2e8f0"
                  className="dark:stroke-slate-800"
                  strokeWidth="16"
                  fill="transparent"
                />
                
                {stroke1_5 > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke="#10b981"
                    strokeWidth="16"
                    strokeDasharray={`${stroke1_5} ${circumference}`}
                    strokeDashoffset={offset1_5}
                    fill="transparent"
                    className="transition-all duration-500 hover:opacity-80"
                  />
                )}

                {stroke1_0 > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke="#3b82f6"
                    strokeWidth="16"
                    strokeDasharray={`${stroke1_0} ${circumference}`}
                    strokeDashoffset={offset1_0}
                    fill="transparent"
                    className="transition-all duration-500 hover:opacity-80"
                  />
                )}

                {stroke3_0 > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke="#a855f7"
                    strokeWidth="16"
                    strokeDasharray={`${stroke3_0} ${circumference}`}
                    strokeDashoffset={offset3_0}
                    fill="transparent"
                    className="transition-all duration-500 hover:opacity-80"
                  />
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  OT รวม
                </span>
                <span className="text-2xl font-black text-slate-800 dark:text-white">
                  {summary.totalOtHours}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  ชั่วโมง
                </span>
              </div>
            </div>

            {/* Detailed Legend List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-500"></span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">OT 1.5 เท่า</span>
                  <span className="text-[10px] text-slate-400">(วันปกติ)</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{summary.totalOt1_5_hours} ชม.</span>
                  <span className="text-slate-400 text-[11px] ml-1.5">({p1_5.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-500"></span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">OT 1.0 เท่า</span>
                  <span className="text-[10px] text-slate-400">(วันหยุด)</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{summary.totalOt1_0_hours} ชม.</span>
                  <span className="text-slate-400 text-[11px] ml-1.5">({p1_0.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-500"></span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">OT 3.0 เท่า</span>
                  <span className="text-[10px] text-slate-400">(ล่วงเวลาหยุด)</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{summary.totalOt3_0_hours} ชม.</span>
                  <span className="text-slate-400 text-[11px] ml-1.5">({p3_0.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              อัตราเฉลี่ย: ฿{(summary.totalOtAmount / (summary.totalOtHours || 1)).toFixed(2)} / ชม.
            </span>
          </div>
        </div>

      </div>

      {/* Chart 3: Income Composition Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          โครงสร้างรายได้รวม (Income Composition)
        </h4>

        {/* Segmented Horizontal Bar */}
        <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            style={{ width: `${salaryPct}%` }}
            className="bg-indigo-600 h-full transition-all duration-500"
            title={`เงินเดือนพื้นฐาน: ${salaryPct.toFixed(1)}%`}
          />
          <div
            style={{ width: `${otPct}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title={`ค่าล่วงเวลา OT: ${otPct.toFixed(1)}%`}
          />
          <div
            style={{ width: `${allowPct}%` }}
            className="bg-purple-500 h-full transition-all duration-500"
            title={`สวัสดิการ & ค่ากะ: ${allowPct.toFixed(1)}%`}
          />
        </div>

        {/* Legend with Values */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">ฐานเงินเดือน</span>
                <span className="text-[10px] text-slate-400">{salaryPct.toFixed(1)}% ของรายได้</span>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300">฿{formatCurrency(settings.baseSalary)}</span>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">ค่าล่วงเวลา (OT)</span>
                <span className="text-[10px] text-slate-400">{otPct.toFixed(1)}% ของรายได้</span>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300">฿{formatCurrency(summary.totalOtAmount)}</span>
          </div>

          <div className="bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500"></span>
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">สวัสดิการ & ค่ากะ</span>
                <span className="text-[10px] text-slate-400">{allowPct.toFixed(1)}% ของรายได้</span>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300">
              ฿{formatCurrency(summary.totalFixedAllowances + summary.diligenceAmount + summary.shiftAmount)}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
