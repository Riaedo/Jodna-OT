import React from 'react';
import { PayrollSummary } from '../types/overtime';
import { formatCurrency } from '../utils/calculator';
import { PieChart, Clock, Calculator, Zap, ShieldAlert } from 'lucide-react';

interface OTShareCardProps {
  summary: PayrollSummary;
}

export const OTShareCard: React.FC<OTShareCardProps> = ({ summary }) => {
  const totalHours = summary.totalOtHours || 1;
  const p1_5 = summary.totalOtHours > 0 ? (summary.totalOt1_5_hours / totalHours) * 100 : 0;
  const p1_0 = summary.totalOtHours > 0 ? (summary.totalOt1_0_hours / totalHours) * 100 : 0;
  const p3_0 = summary.totalOtHours > 0 ? (summary.totalOt3_0_hours / totalHours) * 100 : 0;

  // Donut SVG circumference calculation
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  
  const stroke1_5 = (p1_5 / 100) * circumference;
  const stroke1_0 = (p1_0 / 100) * circumference;
  const stroke3_0 = (p3_0 / 100) * circumference;

  const offset1_5 = 0;
  const offset1_0 = -stroke1_5;
  const offset3_0 = -(stroke1_5 + stroke1_0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      
      {/* Upper Section: Donut Chart on Left, OT Rate Cards on Right */}
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800/80">
        
        {/* Left Side: Donut / Pie Chart */}
        <div className="flex items-center gap-5 sm:gap-6 shrink-0 w-full sm:w-auto justify-center sm:justify-start">
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
            <svg className="w-32 h-32 sm:w-36 sm:h-36 transform -rotate-90" viewBox="0 0 130 130">
              <circle
                cx="65"
                cy="65"
                r={radius}
                stroke="#e2e8f0"
                className="dark:stroke-slate-800"
                strokeWidth="14"
                fill="transparent"
              />
              
              {stroke1_5 > 0 && (
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray={`${stroke1_5} ${circumference}`}
                  strokeDashoffset={offset1_5}
                  fill="transparent"
                  className="transition-all duration-500"
                />
              )}

              {stroke1_0 > 0 && (
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  stroke="#3b82f6"
                  strokeWidth="14"
                  strokeDasharray={`${stroke1_0} ${circumference}`}
                  strokeDashoffset={offset1_0}
                  fill="transparent"
                  className="transition-all duration-500"
                />
              )}

              {stroke3_0 > 0 && (
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  stroke="#a855f7"
                  strokeWidth="14"
                  strokeDasharray={`${stroke3_0} ${circumference}`}
                  strokeDashoffset={offset3_0}
                  fill="transparent"
                  className="transition-all duration-500"
                />
              )}
            </svg>

            {/* Center Summary */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                OT รวม
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                {summary.totalOtHours}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                ชั่วโมง
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <PieChart className="w-4 h-4" />
              </span>
              <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                สัดส่วนโอที (OT Share)
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px] sm:max-w-xs">
              สรุปอัตราการทำงานล่วงเวลาแยกตามเรทตัวคูณประจำงวดนี้
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>เรทฐาน OT: ฿{formatCurrency(summary.hourlyRate)}/ชม.</span>
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Breakdown List per Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:flex-1">
          {/* OT 1.5 Card */}
          <div className="flex sm:flex-col items-center sm:items-start justify-between p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">OT 1.5 เท่า</span>
            </div>
            <div className="mt-0 sm:mt-2 text-right sm:text-left">
              <div className="flex items-baseline gap-1 justify-end sm:justify-start">
                <span className="font-extrabold text-slate-900 dark:text-white text-base">
                  {summary.totalOt1_5_hours}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">ชม.</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold ml-1">
                  ({p1_5.toFixed(1)}%)
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block mt-0.5">
                ฿{formatCurrency(summary.ot1_5_amount)}
              </span>
            </div>
          </div>

          {/* OT 1.0 Card */}
          <div className="flex sm:flex-col items-center sm:items-start justify-between p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">OT 1.0 เท่า</span>
            </div>
            <div className="mt-0 sm:mt-2 text-right sm:text-left">
              <div className="flex items-baseline gap-1 justify-end sm:justify-start">
                <span className="font-extrabold text-slate-900 dark:text-white text-base">
                  {summary.totalOt1_0_hours}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">ชม.</span>
                <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold ml-1">
                  ({p1_0.toFixed(1)}%)
                </span>
              </div>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 block mt-0.5">
                ฿{formatCurrency(summary.ot1_0_amount)}
              </span>
            </div>
          </div>

          {/* OT 3.0 Card */}
          <div className="flex sm:flex-col items-center sm:items-start justify-between p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">OT 3.0 เท่า</span>
            </div>
            <div className="mt-0 sm:mt-2 text-right sm:text-left">
              <div className="flex items-baseline gap-1 justify-end sm:justify-start">
                <span className="font-extrabold text-slate-900 dark:text-white text-base">
                  {summary.totalOt3_0_hours}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">ชม.</span>
                <span className="text-purple-600 dark:text-purple-400 text-xs font-semibold ml-1">
                  ({p3_0.toFixed(1)}%)
                </span>
              </div>
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block mt-0.5">
                ฿{formatCurrency(summary.ot3_0_amount)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Lower Integrated OT Summary Bar */}
      <div className="p-2.5 sm:p-4 bg-slate-900 dark:bg-slate-950 text-white grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="bg-slate-800/80 dark:bg-slate-900/90 p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block truncate">
            ชั่วโมง OT รวม
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-400 truncate block">
            {summary.totalOtHours} ชม.
          </span>
        </div>

        <div className="bg-slate-800/80 dark:bg-slate-900/90 p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block truncate">
            ค่า OT รวมทั้งสิ้น
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-300 truncate block">
            ฿{formatCurrency(summary.totalOtAmount)}
          </span>
        </div>

        <div className="bg-slate-800/80 dark:bg-slate-900/90 p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block truncate">
            ค่า OT 1.5 รวม
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-400 truncate block">
            ฿{formatCurrency(summary.ot1_5_amount)}
          </span>
        </div>

        <div className="bg-slate-800/80 dark:bg-slate-900/90 p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block truncate">
            ค่า OT 1.0 รวม
          </span>
          <span className="text-sm sm:text-base font-black text-blue-300 truncate block">
            ฿{formatCurrency(summary.ot1_0_amount)}
          </span>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-slate-800/80 dark:bg-slate-900/90 p-2 sm:p-2.5 rounded-xl border border-slate-700/80 flex items-center justify-between lg:block">
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block truncate">
            ค่า OT 3.0 รวม
          </span>
          <span className="text-sm sm:text-base font-black text-purple-300 truncate block">
            ฿{formatCurrency(summary.ot3_0_amount)}
          </span>
        </div>
      </div>

    </div>
  );
};
