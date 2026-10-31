import React, { useState, useRef, useEffect } from 'react';
import { 
  PlusCircle, 
  Settings, 
  FileSpreadsheet, 
  Printer, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  CalendarCheck,
  CalendarDays,
  Menu,
  X,
  Pencil,
  Table,
  Calendar,
  LayoutDashboard
} from 'lucide-react';
import { PayrollSettings, AppView } from '../types/overtime';
import { renderAppIcon } from './BrandEditModal';
import { UserAuthButton } from './UserAuthButton';

interface NavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  onOpenRecordModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenPaySlipModal: () => void;
  onOpenBrandEditModal?: () => void;
  onExportCsv: () => void;
  onResetData: () => void;
  settings: PayrollSettings;
  cycleLabel: string;
  onPrevCycle: () => void;
  onNextCycle: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  // Enhanced cycle navigation props
  cycleOffset?: number;
  targetYear?: number;
  targetMonth?: number;
  onResetToCurrentCycle?: () => void;
  onSelectCycle?: (year: number, month: number) => void;
  // Bounding & empty work start date props
  hasWorkStartDate?: boolean;
  minYear?: number;
  maxYear?: number;
  minMonth?: number;
  maxMonth?: number;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  onOpenRecordModal,
  onOpenSettingsModal,
  onOpenPaySlipModal,
  onOpenBrandEditModal,
  onExportCsv,
  onResetData,
  settings,
  cycleLabel,
  onPrevCycle,
  onNextCycle,
  theme,
  onToggleTheme,
  cycleOffset = 0,
  targetYear = 2026,
  targetMonth = 9,
  onResetToCurrentCycle,
  onSelectCycle,
  hasWorkStartDate = true,
  minYear = 2026,
  maxYear = 2026,
  minMonth = 9,
  maxMonth = 9,
  isPrevDisabled = false,
  isNextDisabled = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Cycle Picker Popover state
  const [isCyclePickerOpen, setIsCyclePickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(targetYear);
  const cyclePickerRef = useRef<HTMLDivElement>(null);
  const cycleButtonRef = useRef<HTMLButtonElement>(null);

  // Sync pickerYear when targetYear changes externally
  useEffect(() => {
    if (targetYear) {
      setPickerYear(targetYear);
    }
  }, [targetYear]);

  // Close cycle picker on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cyclePickerRef.current && 
        !cyclePickerRef.current.contains(event.target as Node) &&
        cycleButtonRef.current &&
        !cycleButtonRef.current.contains(event.target as Node)
      ) {
        setIsCyclePickerOpen(false);
      }
    };
    if (isCyclePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCyclePickerOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const appName = settings.appName || 'OT PayMaster';
  const appSubtitle = settings.appSubtitle || 'ระบบคำนวณโอทีและสลิปเงินเดือน';
  const appIcon = settings.appIcon || 'Calculator';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-sm backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-4">
          
          {/* 5: Logo & Brand (กำหนดให้แก้ไขชื่อและรูปไอคอนได้) */}
          <div 
            onClick={onOpenBrandEditModal}
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group rounded-xl p-1 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="คลิกเพื่อแก้ไขชื่อระบบและรูปไอคอน"
          >
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0 group-hover:scale-105 transition-transform">
              {renderAppIcon(appIcon, 'w-4 h-4 sm:w-4.5 sm:h-4.5')}
              <span className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 text-indigo-600 rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="w-2.5 h-2.5" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-extrabold text-xs sm:text-base tracking-tight text-slate-900 dark:text-white truncate max-w-[70px] xs:max-w-[110px] sm:max-w-[200px]">
                  {appName}
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                  กะ {settings.shiftGroup}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden md:block truncate max-w-[200px]">
                {appSubtitle}
              </p>
            </div>
          </div>

          {/* 6: Cycle Navigation with Direct Month/Year Picker & Return to Current button */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 relative">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-0.5 sm:px-1 py-0.5 sm:py-1 shadow-inner">
              <button
                onClick={onPrevCycle}
                disabled={!hasWorkStartDate || isPrevDisabled}
                title={!hasWorkStartDate ? 'ยังไม่ได้ระบุวันเริ่มทำงาน' : isPrevDisabled ? 'ถึงรอบเริ่มต้นทำงานแล้ว' : 'รอบก่อนหน้า'}
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                  !hasWorkStartDate || isPrevDisabled
                    ? 'opacity-30 text-slate-400 cursor-not-allowed'
                    : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Clickable Cycle Capsule */}
              <button
                ref={cycleButtonRef}
                onClick={() => setIsCyclePickerOpen(!isCyclePickerOpen)}
                className={`px-1.5 sm:px-2.5 py-0.5 rounded-lg transition-all text-center flex items-center justify-center gap-1 sm:gap-1.5 group min-w-[70px] xs:min-w-[95px] sm:min-w-[145px] ${
                  isCyclePickerOpen 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'hover:bg-white dark:hover:bg-slate-700/80'
                }`}
                title={hasWorkStartDate ? "คลิกเพื่อเลือกรอบเดือนและปีโดยตรง หรือกลับรอบปัจจุบัน" : "ยังไม่ได้ระบุวันเริ่มทำงาน"}
              >
                <div className="flex-1 text-center">
                  <span className={`text-[8px] sm:text-[9px] uppercase tracking-wider font-bold block leading-tight flex items-center justify-center gap-0.5 sm:gap-1 ${
                    isCyclePickerOpen ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'
                  }`}>
                    <span>รอบตัดวิก</span>
                    <ChevronDown className={`w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform ${isCyclePickerOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                  </span>
                  <span className={`text-[10px] sm:text-xs font-bold truncate block max-w-[90px] xs:max-w-[125px] sm:max-w-none ${
                    isCyclePickerOpen ? 'text-white' : 'text-slate-800 dark:text-slate-100'
                  }`}>
                    {hasWorkStartDate ? (cycleLabel || '-') : '-'}
                  </span>
                </div>
              </button>

              <button
                onClick={onNextCycle}
                disabled={!hasWorkStartDate || isNextDisabled}
                title={!hasWorkStartDate ? 'ยังไม่ได้ระบุวันเริ่มทำงาน' : isNextDisabled ? 'ถึงรอบตัดวิกล่าสุดแล้ว' : 'รอบถัดไป'}
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                  !hasWorkStartDate || isNextDisabled
                    ? 'opacity-30 text-slate-400 cursor-not-allowed'
                    : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Quick "กลับรอบปัจจุบัน" button */}
            {hasWorkStartDate && cycleOffset !== undefined && cycleOffset !== 0 && onResetToCurrentCycle && (
              <button
                onClick={onResetToCurrentCycle}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[10px] sm:text-xs font-bold shadow-md shadow-indigo-600/25 active:scale-95 transition-all shrink-0 animate-in fade-in"
                title="คลิกเพื่อกลับไปยังรอบตัดวิกปัจจุบัน"
              >
                <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="hidden xs:inline">รอบปัจจุบัน</span>
              </button>
            )}

            {/* Direct Month & Year Picker Popover */}
            {isCyclePickerOpen && (
              <div
                ref={cyclePickerRef}
                className="absolute top-12 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-[295px] xs:w-[320px] sm:w-[340px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                        เลือกรอบตัดวิกเงินเดือน
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        รอบตัดวิก: วันที่ {settings.cycleStartDay} - {settings.cycleEndDay}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCyclePickerOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!hasWorkStartDate ? (
                  <div className="p-4 text-center space-y-3">
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      ยังไม่ได้ระบุวันเริ่มทำงาน
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      ในส่วนรอบเดือนจะคืนค่าเป็นว่างไว้ กรุณาระบุวันเริ่มทำงานในเมนู "ตั้งค่า" เพื่อเริ่มคำนวณและแสดงผลรอบเดือน
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCyclePickerOpen(false);
                        onOpenSettingsModal();
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      ไปที่เมนูตั้งค่า
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Quick Action: Return to Current Cycle */}
                    {onResetToCurrentCycle && (
                      <button
                        onClick={() => {
                          onResetToCurrentCycle();
                          setIsCyclePickerOpen(false);
                        }}
                        className={`w-full mb-2.5 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                          cycleOffset === 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 pointer-events-none'
                            : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 active:scale-95'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{cycleOffset === 0 ? '✓ กำลังอยู่ในรอบปัจจุบัน' : '⚡ กลับมารอบตัดวิกปัจจุบัน'}</span>
                        </span>
                        {cycleOffset !== 0 && (
                          <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono">คลิกเพื่อกลับ</span>
                        )}
                      </button>
                    )}

                    {/* Year Selector */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl mb-2.5 border border-slate-200/80 dark:border-slate-700/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          onClick={() => setPickerYear((y) => Math.max(minYear, y - 1))}
                          disabled={pickerYear <= minYear}
                          className={`p-1 rounded-lg transition-colors ${
                            pickerYear <= minYear
                              ? 'opacity-30 text-slate-400 cursor-not-allowed'
                              : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                          title="ปีก่อนหน้า"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          ปี ค.ศ. {pickerYear} <span className="text-[10px] text-slate-400 font-normal">(พ.ศ. {pickerYear + 543})</span>
                        </span>
                        <button
                          onClick={() => setPickerYear((y) => Math.min(maxYear, y + 1))}
                          disabled={pickerYear >= maxYear}
                          className={`p-1 rounded-lg transition-colors ${
                            pickerYear >= maxYear
                              ? 'opacity-30 text-slate-400 cursor-not-allowed'
                              : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                          title="ปีถัดไป"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Year shortcut buttons (Bounded strictly from minYear to maxYear) */}
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, i) => minYear + i).map((yr) => (
                          <button
                            key={yr}
                            onClick={() => setPickerYear(yr)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                              pickerYear === yr
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {yr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 12 Months Grid (Bounded from start month in start year to latest month in latest year) */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { idx: 0, short: 'ม.ค.' },
                        { idx: 1, short: 'ก.พ.' },
                        { idx: 2, short: 'มี.ค.' },
                        { idx: 3, short: 'เม.ย.' },
                        { idx: 4, short: 'พ.ค.' },
                        { idx: 5, short: 'มิ.ย.' },
                        { idx: 6, short: 'ก.ค.' },
                        { idx: 7, short: 'ส.ค.' },
                        { idx: 8, short: 'ก.ย.' },
                        { idx: 9, short: 'ต.ค.' },
                        { idx: 10, short: 'พ.ย.' },
                        { idx: 11, short: 'ธ.ค.' },
                      ].map((m) => {
                        const isCurrentActive = targetYear === pickerYear && targetMonth === m.idx;
                        const isBeforeStartMonth = pickerYear === minYear && m.idx < minMonth;
                        const isAfterLatestMonth = pickerYear === maxYear && m.idx > maxMonth;
                        const isMonthDisabled = isBeforeStartMonth || isAfterLatestMonth;

                        return (
                          <button
                            key={m.idx}
                            disabled={isMonthDisabled}
                            onClick={() => {
                              if (!isMonthDisabled && onSelectCycle) {
                                onSelectCycle(pickerYear, m.idx);
                              }
                              setIsCyclePickerOpen(false);
                            }}
                            className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center relative ${
                              isMonthDisabled
                                ? 'opacity-25 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 text-slate-400'
                                : isCurrentActive
                                ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400 scale-[1.02]'
                                : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60'
                            }`}
                            title={isMonthDisabled ? 'อยู่นอกช่วงเวลาทำงาน' : undefined}
                          >
                            <span className="text-xs font-bold leading-tight">{m.short}</span>
                            <span className={`text-[8px] font-mono leading-tight mt-0.5 ${
                              isCurrentActive ? 'text-indigo-100' : 'text-slate-400'
                            }`}>
                              {String(m.idx + 1).padStart(2, '0')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Popover Footer Info */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>แตะเดือนเพื่อเปลี่ยนรอบทันที</span>
                  <span className="font-bold text-indigo-500">กำลังดู: {pickerYear}</span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Navigation Tabs - 3: ปรับรายชื่อปุ่มลดข้อความ */}
          <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setCurrentView('timesheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'timesheet'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              ตารางเวลา
            </button>
            <button
              onClick={() => setCurrentView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              ปฏิทินกะ
            </button>
            <button
              onClick={() => setCurrentView('leave')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'leave'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              บันทึกการลา
            </button>
            <button
              onClick={() => setCurrentView('holidays')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'holidays'
                  ? 'bg-amber-500 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              วันหยุด
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              แดชบอร์ด
            </button>
          </div>

          {/* User Auth & Sync Button */}
          <UserAuthButton />

          {/* Action Menu (Hamburger with Record, PaySlip, Settings, etc.) */}
          <div className="flex items-center relative shrink-0">
            
            {/* Hamburger Button */}
            <button
              ref={buttonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="เมนูหลัก (บันทึก, สลิป, การตั้งค่า, ธีม)"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all ${
                isMenuOpen
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
              }`}
              aria-label="Toggle Menu"
            >
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span className="text-xs font-bold hidden xs:inline-block">เมนู</span>
            </button>

            {/* Hamburger Dropdown Popover */}
            {isMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-11 mt-1.5 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right backdrop-blur-md"
              >
                {/* Menu Header */}
                <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    เมนูการทำงาน & การตั้งค่า
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    กะ {settings.shiftGroup}
                  </span>
                </div>

                <div className="py-1.5 space-y-1">
                  
                  {/* 1. Quick Record Button (บันทึก) */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenRecordModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/30 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/50 dark:hover:to-teal-900/40 border border-emerald-200/80 dark:border-emerald-800/50 text-left transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 group-hover:scale-105 transition-transform">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                          บันทึก
                        </span>
                        <span className="text-[9px] font-bold px-1 rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
                          OT / วันลา
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 truncate block mt-0.5">
                        บันทึกชั่วโมงโอที หรือลงสถานะวันลา
                      </span>
                    </div>
                  </button>

                  {/* 2. PaySlip Button (สลิป) */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenPaySlipModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/30 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/50 dark:hover:to-orange-900/40 border border-amber-200/80 dark:border-amber-800/50 text-left transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-amber-500 text-white shadow-sm shadow-amber-500/30 group-hover:scale-105 transition-transform">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                          สลิป
                        </span>
                        <span className="text-[9px] font-bold px-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          สลิปเงินเดือน
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 truncate block mt-0.5">
                        ดูใบแจ้งยอดเงินได้ สรุปโอที และพิมพ์สลิป
                      </span>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  
                  {/* Brand & Name Edit Item */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenBrandEditModal) onOpenBrandEditModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                        แก้ไขชื่อและไอคอนระบบ
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">
                        เปลี่ยนชื่อแบรนด์หรือสัญลักษณ์
                      </span>
                    </div>
                  </button>

                  {/* Settings Item */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenSettingsModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        การตั้งค่าระบบ (Settings)
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">
                        ฐานเงินเดือน, สลับกะ, สิทธิ์วันลา
                      </span>
                    </div>
                  </button>

                  {/* Theme Toggle Item */}
                  <button
                    onClick={() => {
                      onToggleTheme();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          โหมดธีม
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {theme === 'dark' ? 'มืด (Dark)' : 'สว่าง (Light)'}
                        </span>
                      </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
                      theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                        theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>

                  {/* Export CSV Item */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onExportCsv();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        ส่งออกไฟล์ Excel (CSV)
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">
                        ดาวน์โหลดข้อมูลวิกนี้
                      </span>
                    </div>
                  </button>

                  {/* Reset & Start Fresh Item */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onResetData();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">
                        ลบข้อมูล & เริ่มบันทึกใหม่
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">
                        กำหนดวันเริ่มทำงานแล้วบันทึกใหม่
                      </span>
                    </div>
                  </button>

                </div>
              </div>
            )}

          </div>

        </div>

        {/* 6: Mobile Sub-Navigation Bar (Optimized for smooth touch without clipping or overflowing) */}
        <div className="flex lg:hidden border-t border-slate-200 dark:border-slate-800 py-1.5 px-1 overflow-x-auto scrollbar-none gap-1 sm:justify-around text-xs">
          <button
            onClick={() => setCurrentView('timesheet')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              currentView === 'timesheet'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">ตารางเวลา</span>
          </button>
          <button
            onClick={() => setCurrentView('calendar')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              currentView === 'calendar'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">ปฏิทินกะ</span>
          </button>
          <button
            onClick={() => setCurrentView('leave')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              currentView === 'leave'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">บันทึกการลา</span>
          </button>
          <button
            onClick={() => setCurrentView('holidays')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              currentView === 'holidays'
                ? 'bg-amber-500 text-white font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">วันหยุด</span>
          </button>
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              currentView === 'dashboard'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">แดชบอร์ด</span>
          </button>
        </div>

      </div>

    </header>
  );
};
