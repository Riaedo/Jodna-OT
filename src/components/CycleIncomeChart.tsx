import React, { useState, useMemo } from 'react';
import * as d3 from 'd3';
import { DailyRecord, PayrollSettings, PayrollSummary } from '../types/overtime';
import { calculatePayroll, createCycleRecords, formatCurrency } from '../utils/calculator';
import { BarChart3, TrendingUp, Info } from 'lucide-react';

interface CycleIncomeChartProps {
  allCycleRecords: Record<string, DailyRecord[]>;
  cycleTaxes?: Record<string, number>;
  settings: PayrollSettings;
  currentCycleKey: string;
  onSelectCycle?: (offset: number) => void;
}

interface CycleDataPoint {
  cycleKey: string;
  monthOffset: number; // relative to base (October 2026 = 0)
  shortLabel: string;
  cycleFullLabel: string;
  isCurrent: boolean;
  summary: PayrollSummary;
  gross: number;
  net: number;
  tax: number; // 2: ภาษีที่จ่าย
  ot: number;
  otHours: number;
  deductions: number;
}

export const CycleIncomeChart: React.FC<CycleIncomeChartProps> = ({
  allCycleRecords,
  cycleTaxes,
  settings,
  currentCycleKey,
  onSelectCycle,
}) => {
  // View mode: 'grouped' (Gross vs Net vs Tax), 'net' (Net Only), 'tax' (Tax Only), or 'ot' (OT Only)
  const [chartMode, setChartMode] = useState<'grouped' | 'net' | 'tax' | 'ot'>('grouped');
  const [hoveredPoint, setHoveredPoint] = useState<CycleDataPoint | null>(null);

  // Generate 6 recent monthly cycles (e.g. May 2026 to Oct 2026)
  const cycleData: CycleDataPoint[] = useMemo(() => {
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    // Target range: 5 months back to current cycle
    const points: CycleDataPoint[] = [];
    const baseYear = 2026;
    const baseMonth = 9; // October 2026 (index 9)

    // Parse current cycle offset relative to October 2026
    const [cYear, cMonth] = currentCycleKey.split('-').map(Number);
    const activeOffset = (cYear - baseYear) * 12 + (cMonth - 1 - baseMonth);

    // Show 6 cycles ending at the active cycle (or active + 1)
    const startOffset = activeOffset - 4;
    const endOffset = activeOffset + 1;

    for (let offset = startOffset; offset <= endOffset; offset++) {
      const d = new Date(baseYear, baseMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const isCurrent = key === currentCycleKey;

      let records: DailyRecord[];
      if (allCycleRecords[key] && allCycleRecords[key].length > 0) {
        records = allCycleRecords[key];
      } else {
        // Generate baseline records with real data (no mock overtime)
        records = createCycleRecords(y, m, settings);
      }

      // Per-cycle tax paid
      const cycleTax = cycleTaxes?.[key] ?? (isCurrent ? (settings.taxPaid || 0) : 0);
      const summary = calculatePayroll(records, {
        ...settings,
        taxPaid: cycleTax,
      });
      const thaiM = thaiMonths[m];
      const prevM = m === 0 ? thaiMonths[11] : thaiMonths[m - 1];

      points.push({
        cycleKey: key,
        monthOffset: offset,
        shortLabel: `${thaiM} ${y}`,
        cycleFullLabel: `${settings.cycleStartDay} ${prevM} - ${settings.cycleEndDay} ${thaiM} ${y}`,
        isCurrent,
        summary,
        gross: summary.totalGrossIncome,
        net: summary.netIncome,
        tax: cycleTax,
        ot: summary.totalOtAmount,
        otHours: summary.totalOtHours,
        deductions: summary.totalDeductions,
      });
    }

    return points;
  }, [allCycleRecords, cycleTaxes, settings, currentCycleKey]);

  // 1: ปรับขนาดกราฟแท่ง D3 ลง 50% (svgHeight 115, margin กะทัดรัด)
  const svgWidth = 640;
  const svgHeight = 115;
  const margin = { top: 12, right: 15, bottom: 24, left: 45 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const xScale = useMemo(() => {
    return d3
      .scaleBand<string>()
      .domain(cycleData.map((d) => d.cycleKey))
      .range([0, innerWidth])
      .padding(0.28);
  }, [cycleData, innerWidth]);

  const maxVal = useMemo(() => {
    if (chartMode === 'ot') {
      const maxOt = d3.max(cycleData, (d) => d.ot) || 10000;
      return Math.max(12000, maxOt * 1.25);
    }
    if (chartMode === 'tax') {
      const maxTax = d3.max(cycleData, (d) => d.tax) || 3000;
      return Math.max(4000, maxTax * 1.3);
    }
    const maxGross = d3.max(cycleData, (d) => Math.max(d.gross, d.net, d.tax)) || 50000;
    return Math.max(55000, maxGross * 1.15);
  }, [cycleData, chartMode]);

  const yScale = useMemo(() => {
    return d3.scaleLinear().domain([0, maxVal]).range([innerHeight, 0]).nice();
  }, [maxVal, innerHeight]);

  // Y-axis tick values (3 ticks for compact height)
  const yTicks = useMemo(() => {
    return yScale.ticks(3);
  }, [yScale]);

  // Current cycle vs previous cycle comparison
  const activePoint = cycleData.find((d) => d.isCurrent) || cycleData[cycleData.length - 1];
  const activeIndex = cycleData.findIndex((d) => d.cycleKey === activePoint.cycleKey);
  const prevPoint = activeIndex > 0 ? cycleData[activeIndex - 1] : null;

  const diffNet = prevPoint ? activePoint.net - prevPoint.net : 0;
  const diffPercent = prevPoint && prevPoint.net > 0 ? (diffNet / prevPoint.net) * 100 : 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 sm:p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      
      {/* Chart Header - Compact (50% scale) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              แนวโน้มรายได้เปรียบเทียบแต่ละรอบวิก (Income Trends by Cycle)
            </h3>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              D3
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            เปรียบเทียบรายได้รวม, สุทธิ, ภาษีที่จ่าย, และ OT (คลิกที่แท่งเพื่อเปลี่ยนรอบตัดวิก)
          </p>
        </div>

        {/* View Mode Filters: 2. เพิ่ม ภาษีที่จ่าย เข้าไปในกราฟ */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg self-start sm:self-auto text-[10px] font-semibold overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => setChartMode('grouped')}
            className={`shrink-0 px-2 py-0.5 rounded transition-all ${
              chartMode === 'grouped'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            รวม / สุทธิ / ภาษี
          </button>
          <button
            onClick={() => setChartMode('net')}
            className={`shrink-0 px-2 py-0.5 rounded transition-all ${
              chartMode === 'net'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            สุทธิรับจริง
          </button>
          <button
            onClick={() => setChartMode('tax')}
            className={`shrink-0 px-2 py-0.5 rounded transition-all ${
              chartMode === 'tax'
                ? 'bg-rose-500 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            ภาษีที่จ่าย
          </button>
          <button
            onClick={() => setChartMode('ot')}
            className={`shrink-0 px-2 py-0.5 rounded transition-all ${
              chartMode === 'ot'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            ค่า OT
          </button>
        </div>
      </div>

      {/* Mini Trend Summary Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 py-1 px-2.5 my-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-[10px] sm:text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">รอบปัจจุบัน:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {activePoint.shortLabel}
          </span>
          <span className="font-black text-emerald-600 dark:text-emerald-400">
            สุทธิ: ฿{formatCurrency(activePoint.net)}
          </span>
          {activePoint.tax > 0 && (
            <span className="font-bold text-rose-500 dark:text-rose-400">
              (ภาษี: ฿{formatCurrency(activePoint.tax)})
            </span>
          )}
        </div>

        {prevPoint && (
          <div className="flex items-center gap-1 font-medium text-[10px]">
            <span className="text-slate-400">เทียบกับรอบ {prevPoint.shortLabel}:</span>
            <span
              className={`flex items-center gap-0.5 font-bold ${
                diffNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              }`}
            >
              <TrendingUp className={`w-3 h-3 ${diffNet < 0 ? 'rotate-180' : ''}`} />
              <span>
                {diffNet >= 0 ? '+' : ''}฿{formatCurrency(diffNet)} ({diffPercent >= 0 ? '+' : ''}
                {diffPercent.toFixed(1)}%)
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Interactive D3 Chart SVG Container (50% scale) */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Gradients */}
          <defs>
            {/* Gross Bar Gradient */}
            <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.75" />
            </linearGradient>

            {/* Net Bar Gradient */}
            <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
            </linearGradient>

            {/* Tax Bar Gradient (2: ภาษีที่จ่าย) */}
            <linearGradient id="taxGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0.85" />
            </linearGradient>

            {/* OT Bar Gradient */}
            <linearGradient id="otGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.8" />
            </linearGradient>

            {/* Active Glow Gradient */}
            <linearGradient id="activeGrossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#4338ca" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((tickVal) => {
              const yPos = yScale(tickVal);
              return (
                <g key={tickVal}>
                  <line
                    x1={0}
                    y1={yPos}
                    x2={innerWidth}
                    y2={yPos}
                    stroke="currentColor"
                    strokeDasharray="2 2"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth={0.8}
                  />
                  <text
                    x={-6}
                    y={yPos + 3}
                    textAnchor="end"
                    className="fill-slate-400 dark:fill-slate-500 text-[8px] font-medium"
                  >
                    ฿{(tickVal / 1000).toFixed(0)}k
                  </text>
                </g>
              );
            })}

            {/* Bars for Each Cycle */}
            {cycleData.map((d) => {
              const xPos = xScale(d.cycleKey) || 0;
              const bandWidth = xScale.bandwidth();

              if (chartMode === 'grouped') {
                // 3 grouped bars: Gross, Net, Tax
                const gap = 2;
                const subWidth = Math.max(4, (bandWidth - gap * 2) / 3);
                const grossHeight = Math.max(0, innerHeight - yScale(d.gross));
                const netHeight = Math.max(0, innerHeight - yScale(d.net));
                const taxHeight = d.tax > 0 ? Math.max(3, innerHeight - yScale(d.tax)) : 0;
                
                const grossY = yScale(d.gross);
                const netY = yScale(d.net);
                const taxY = innerHeight - taxHeight;

                return (
                  <g
                    key={d.cycleKey}
                    className="cursor-pointer transition-all duration-200 group"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => onSelectCycle && onSelectCycle(d.monthOffset)}
                  >
                    {/* Active Cycle Background Highlight */}
                    {d.isCurrent && (
                      <rect
                        x={xPos - 3}
                        y={0}
                        width={bandWidth + 6}
                        height={innerHeight}
                        rx={5}
                        className="fill-indigo-50/70 dark:fill-indigo-950/30"
                      />
                    )}

                    {/* Bar 1: Gross Income */}
                    <rect
                      x={xPos}
                      y={grossY}
                      width={subWidth}
                      height={grossHeight}
                      rx={2.5}
                      fill={d.isCurrent ? 'url(#activeGrossGradient)' : 'url(#grossGradient)'}
                      className="transition-all duration-200 hover:opacity-90"
                    />

                    {/* Bar 2: Net Take-Home Pay */}
                    <rect
                      x={xPos + subWidth + gap}
                      y={netY}
                      width={subWidth}
                      height={netHeight}
                      rx={2.5}
                      fill="url(#netGradient)"
                      className="transition-all duration-200 hover:opacity-90"
                    />

                    {/* Bar 3: Tax Paid (2: เพิ่มภาษีที่จ่ายเข้าไปในกราฟแท่ง) */}
                    <rect
                      x={xPos + (subWidth + gap) * 2}
                      y={taxY}
                      width={subWidth}
                      height={taxHeight}
                      rx={2.5}
                      fill="url(#taxGradient)"
                      className="transition-all duration-200 hover:opacity-90"
                    />

                    {/* Active Indicator Dot */}
                    {d.isCurrent && (
                      <circle
                        cx={xPos + bandWidth / 2}
                        cy={-5}
                        r={2.5}
                        className="fill-indigo-600 dark:fill-indigo-400 animate-pulse"
                      />
                    )}

                    {/* X-Axis Month Label */}
                    <text
                      x={xPos + bandWidth / 2}
                      y={innerHeight + 12}
                      textAnchor="middle"
                      className={`text-[9px] font-bold ${
                        d.isCurrent
                          ? 'fill-indigo-600 dark:fill-indigo-400 font-extrabold'
                          : 'fill-slate-600 dark:fill-slate-400'
                      }`}
                    >
                      {d.shortLabel}
                    </text>

                    {d.isCurrent && (
                      <text
                        x={xPos + bandWidth / 2}
                        y={innerHeight + 20}
                        textAnchor="middle"
                        className="fill-indigo-500 dark:fill-indigo-300 text-[7px] font-black uppercase"
                      >
                        (รอบนี้)
                      </text>
                    )}
                  </g>
                );
              } else if (chartMode === 'net') {
                const netHeight = Math.max(0, innerHeight - yScale(d.net));
                const netY = yScale(d.net);

                return (
                  <g
                    key={d.cycleKey}
                    className="cursor-pointer transition-all duration-200 group"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => onSelectCycle && onSelectCycle(d.monthOffset)}
                  >
                    {d.isCurrent && (
                      <rect
                        x={xPos - 3}
                        y={0}
                        width={bandWidth + 6}
                        height={innerHeight}
                        rx={5}
                        className="fill-emerald-50/70 dark:fill-emerald-950/20"
                      />
                    )}

                    <rect
                      x={xPos}
                      y={netY}
                      width={bandWidth}
                      height={netHeight}
                      rx={4}
                      fill="url(#netGradient)"
                      className="transition-all duration-200 hover:opacity-90"
                    />

                    <text
                      x={xPos + bandWidth / 2}
                      y={netY - 4}
                      textAnchor="middle"
                      className="fill-emerald-700 dark:fill-emerald-400 text-[8px] font-black"
                    >
                      ฿{(d.net / 1000).toFixed(1)}k
                    </text>

                    <text
                      x={xPos + bandWidth / 2}
                      y={innerHeight + 12}
                      textAnchor="middle"
                      className={`text-[9px] font-bold ${
                        d.isCurrent
                          ? 'fill-emerald-600 dark:fill-emerald-400 font-extrabold'
                          : 'fill-slate-600 dark:fill-slate-400'
                      }`}
                    >
                      {d.shortLabel}
                    </text>
                  </g>
                );
              } else if (chartMode === 'tax') {
                // 2: Single bar for Tax Paid
                const taxHeight = d.tax > 0 ? Math.max(3, innerHeight - yScale(d.tax)) : 0;
                const taxY = innerHeight - taxHeight;

                return (
                  <g
                    key={d.cycleKey}
                    className="cursor-pointer transition-all duration-200 group"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => onSelectCycle && onSelectCycle(d.monthOffset)}
                  >
                    {d.isCurrent && (
                      <rect
                        x={xPos - 3}
                        y={0}
                        width={bandWidth + 6}
                        height={innerHeight}
                        rx={5}
                        className="fill-rose-50/70 dark:fill-rose-950/20"
                      />
                    )}

                    <rect
                      x={xPos}
                      y={taxY}
                      width={bandWidth}
                      height={taxHeight}
                      rx={4}
                      fill="url(#taxGradient)"
                      className="transition-all duration-200 hover:opacity-90"
                    />

                    <text
                      x={xPos + bandWidth / 2}
                      y={taxY - 4}
                      textAnchor="middle"
                      className="fill-rose-700 dark:fill-rose-400 text-[8px] font-black"
                    >
                      {d.tax > 0 ? `฿${formatCurrency(d.tax)}` : '฿0'}
                    </text>

                    <text
                      x={xPos + bandWidth / 2}
                      y={innerHeight + 12}
                      textAnchor="middle"
                      className={`text-[9px] font-bold ${
                        d.isCurrent
                          ? 'fill-rose-600 dark:fill-rose-400 font-extrabold'
                          : 'fill-slate-600 dark:fill-slate-400'
                      }`}
                    >
                      {d.shortLabel}
                    </text>
                  </g>
                );
              } else {
                // OT Mode
                const otHeight = Math.max(0, innerHeight - yScale(d.ot));
                const otY = yScale(d.ot);

                return (
                  <g
                    key={d.cycleKey}
                    className="cursor-pointer transition-all duration-200 group"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => onSelectCycle && onSelectCycle(d.monthOffset)}
                  >
                    {d.isCurrent && (
                      <rect
                        x={xPos - 3}
                        y={0}
                        width={bandWidth + 6}
                        height={innerHeight}
                        rx={5}
                        className="fill-amber-50/70 dark:fill-amber-950/20"
                      />
                    )}

                    <rect
                      x={xPos}
                      y={otY}
                      width={bandWidth}
                      height={otHeight}
                      rx={4}
                      fill="url(#otGradient)"
                      className="transition-all duration-200 hover:opacity-90"
                    />

                    <text
                      x={xPos + bandWidth / 2}
                      y={otY - 4}
                      textAnchor="middle"
                      className="fill-amber-700 dark:fill-amber-400 text-[8px] font-black"
                    >
                      {d.otHours}h
                    </text>

                    <text
                      x={xPos + bandWidth / 2}
                      y={innerHeight + 12}
                      textAnchor="middle"
                      className={`text-[9px] font-bold ${
                        d.isCurrent
                          ? 'fill-amber-600 dark:fill-amber-400 font-extrabold'
                          : 'fill-slate-600 dark:fill-slate-400'
                      }`}
                    >
                      {d.shortLabel}
                    </text>
                  </g>
                );
              }
            })}
          </g>
        </svg>

        {/* Floating Tooltip - Compact */}
        {hoveredPoint && (
          <div className="absolute top-1 right-1 bg-slate-900/95 dark:bg-slate-800/95 text-white p-2.5 rounded-xl shadow-xl border border-slate-700 text-[11px] backdrop-blur-md pointer-events-none transition-all z-20 min-w-[190px] animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-1 mb-1">
              <span className="font-extrabold text-indigo-300">
                รอบ {hoveredPoint.shortLabel}
              </span>
              {hoveredPoint.isCurrent && (
                <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-500/30 text-indigo-200 rounded">
                  รอบปัจจุบัน
                </span>
              )}
            </div>
            <p className="text-[9px] text-slate-400 mb-1">{hoveredPoint.cycleFullLabel}</p>
            <div className="space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-xs bg-indigo-500 inline-block"></span>
                  รายได้รวมก่อนหัก:
                </span>
                <span className="font-bold text-slate-100">฿{formatCurrency(hoveredPoint.gross)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-xs bg-emerald-500 inline-block"></span>
                  เงินได้สุทธิ:
                </span>
                <span className="font-black text-emerald-400">฿{formatCurrency(hoveredPoint.net)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-rose-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-xs bg-rose-500 inline-block"></span>
                  ภาษีที่จ่าย:
                </span>
                <span className="font-bold text-rose-400">-฿{formatCurrency(hoveredPoint.tax)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-xs bg-amber-500 inline-block"></span>
                  ค่า OT ({hoveredPoint.otHours} ชม.):
                </span>
                <span className="font-semibold text-amber-300">฿{formatCurrency(hoveredPoint.ot)}</span>
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-400 pt-0.5 border-t border-slate-800">
                <span>รวมรายการหักทั้งหมด:</span>
                <span>-฿{formatCurrency(hoveredPoint.deductions)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Legend - Compact (2: มีภาษีที่จ่าย) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-indigo-600"></span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">รวมก่อนหัก</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-emerald-500"></span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">สุทธิ</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-rose-500"></span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">ภาษีที่จ่าย</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-amber-500"></span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">ค่า OT</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[9px] text-slate-400">
          <Info className="w-3 h-3" />
          <span>คลิกที่แท่งเพื่อเปลี่ยนรอบ</span>
        </div>
      </div>

    </div>
  );
};
