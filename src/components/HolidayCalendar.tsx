import React, { useState, useMemo } from 'react';
import { Holiday } from '../types/overtime';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  CalendarCheck, 
  AlertCircle,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  CheckCircle2,
  X,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { 
  filterHolidaysByYear, 
  getAvailableHolidayYears, 
  canCopyHolidaysFromYear, 
  checkDuplicateHoliday,
  shiftHolidayDateToYear
} from '../utils/holidayManager';

interface HolidayCalendarProps {
  holidays: Holiday[];
  onAddHoliday: (holiday: Omit<Holiday, 'id'>) => void;
  onUpdateHoliday: (holiday: Holiday) => void;
  onDeleteHoliday: (id: string) => void;
  onApplyToCurrentCycle: () => void;
  onCopyHolidaysFromYear?: (sourceYear: number, targetYear: number) => Promise<void> | void;
}

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({
  holidays,
  onAddHoliday,
  onUpdateHoliday,
  onDeleteHoliday,
  onApplyToCurrentCycle,
  onCopyHolidaysFromYear,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedSourceYear, setSelectedSourceYear] = useState<number | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ sourceYear: number; targetYear: number } | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<'PUBLIC' | 'COMPANY' | 'SPECIAL'>('PUBLIC');
  const [formNote, setFormNote] = useState('');
  const [allowDuplicateSubmit, setAllowDuplicateSubmit] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Available years: sorted list including 2025, 2026, 2027, 2028 and any years in holidays
  const availableYears = useMemo(() => {
    return getAvailableHolidayYears(holidays, [2025, 2026, 2027, 2028]);
  }, [holidays]);

  // Holidays belonging to the selected year
  const yearHolidays = useMemo(() => {
    return filterHolidaysByYear(holidays, selectedYear);
  }, [holidays, selectedYear]);

  // Filtered by search term
  const filteredHolidays = useMemo(() => {
    if (!searchTerm.trim()) return yearHolidays;
    const term = searchTerm.toLowerCase();
    return yearHolidays.filter(
      (h) => h.name.toLowerCase().includes(term) || h.date.includes(term) || (h.note && h.note.toLowerCase().includes(term))
    );
  }, [yearHolidays, searchTerm]);

  // Check if current year can copy from a prior year template
  const copyCheck = useMemo(() => {
    return canCopyHolidaysFromYear(holidays, selectedYear, selectedSourceYear || undefined);
  }, [holidays, selectedYear, selectedSourceYear]);

  // Candidates for source years that currently have holidays (excluding selectedYear)
  const candidateSourceYears = useMemo(() => {
    return availableYears
      .filter((y) => y !== selectedYear && filterHolidaysByYear(holidays, y).length > 0)
      .reverse();
  }, [availableYears, selectedYear, holidays]);

  const handleOpenAdd = () => {
    setEditingHoliday(null);
    setFormName('');
    // Default date to first day or month of selected year
    setFormDate(`${selectedYear}-01-01`);
    setFormType('PUBLIC');
    setFormNote('');
    setDuplicateWarning(null);
    setAllowDuplicateSubmit(false);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setFormName(h.name);
    setFormDate(h.date);
    setFormType(h.type || 'PUBLIC');
    setFormNote(h.note || '');
    setDuplicateWarning(null);
    setAllowDuplicateSubmit(false);
    setIsAddModalOpen(true);
  };

  const handleOpenCopyModal = () => {
    const defaultSource = copyCheck.sourceYear || (selectedYear - 1);
    setSelectedSourceYear(defaultSource);
    setIsCopyModalOpen(true);
  };

  const handleConfirmCopy = async () => {
    const sourceY = selectedSourceYear || copyCheck.sourceYear || (selectedYear - 1);
    if (!sourceY || !onCopyHolidaysFromYear) return;

    await onCopyHolidaysFromYear(sourceY, selectedYear);
    setIsCopyModalOpen(false);
    setBannerNotice({ sourceYear: sourceY, targetYear: selectedYear });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDate.trim()) return;

    // Check duplicate
    const isDup = checkDuplicateHoliday(holidays, formDate, formName, editingHoliday?.id);
    if (isDup && !allowDuplicateSubmit) {
      setDuplicateWarning(`พบรายการวันหยุดชื่อ "${formName}" ในวันที่ ${formDate} อยู่แล้วในระบบ ต้องการบันทึกรายการนี้ซ้ำหรือไม่?`);
      return;
    }

    if (editingHoliday) {
      onUpdateHoliday({
        ...editingHoliday,
        name: formName.trim(),
        date: formDate.trim(),
        type: formType,
        note: formNote.trim(),
      });
    } else {
      onAddHoliday({
        name: formName.trim(),
        date: formDate.trim(),
        type: formType,
        note: formNote.trim(),
        isCustom: true,
      });
    }
    setIsAddModalOpen(false);
  };

  // Type count breakdown
  const publicCount = yearHolidays.filter((h) => !h.type || h.type === 'PUBLIC').length;
  const companyCount = yearHolidays.filter((h) => h.type === 'COMPANY').length;
  const specialCount = yearHolidays.filter((h) => h.type === 'SPECIAL').length;

  return (
    <div className="space-y-6">
      
      {/* Year Template Notice Banner (Requirement 5) */}
      {bannerNotice && bannerNotice.targetYear === selectedYear && (
        <div className="bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-emerald-500/15 border-2 border-amber-500/40 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>สร้างรายการวันหยุดจากปี {bannerNotice.sourceYear} แล้ว</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  ปี {selectedYear}
                </span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                กรุณาตรวจสอบและปรับวันที่ให้ตรงกับประกาศวันหยุดของปี {bannerNotice.targetYear} โดยเฉพาะวันหยุดชดเชยหรือวันหยุดตามปฏิทินจันทรคติที่อาจมีวันที่เปลี่ยนแปลง
              </p>
            </div>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors shrink-0"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner with Year Selector */}
      <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 dark:from-amber-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 rounded-3xl p-5 sm:p-6 border border-amber-500/30 dark:border-amber-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <span className="text-xs uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">
              จัดการปฏิทินวันหยุดรายปี (Annual Holiday Management)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-2">
            วันหยุดประจำปี ค.ศ. {selectedYear}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            ระบบแยกข้อมูลวันหยุดอิสระในแต่ละปี สามารถคัดลอกจากปีก่อนหน้าเป็นต้นแบบ และปรับแก้ไขหรือเพิ่มลดวันหยุดได้ตามประกาศจริง
          </p>
        </div>

        {/* Year Selector & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Navigator */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-sm shrink-0">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="ปีก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 text-center">
              <span className="text-sm font-black text-slate-800 dark:text-white">
                ปี ค.ศ. {selectedYear}
              </span>
            </div>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="ปีถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            {/* Copy from Previous Year Button (If Year is empty and prior data exists) */}
            {yearHolidays.length === 0 && copyCheck.canCopy && onCopyHolidaysFromYear && (
              <button
                onClick={handleOpenCopyModal}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span>สร้างจากปี {copyCheck.sourceYear}</span>
              </button>
            )}

            <button
              onClick={onApplyToCurrentCycle}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              title="นำวันหยุดที่ตรงกับรอบวิกปัจจุบันไปบันทึกเป็นวันหยุด (H)"
            >
              <CalendarCheck className="w-4 h-4 shrink-0" />
              <span>นำไปใช้รอบนี้</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>เพิ่มวันหยุด</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Year Navigation Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 mr-1">
          เลือกรอบปี:
        </span>
        {availableYears.map((yr) => {
          const count = filterHolidaysByYear(holidays, yr).length;
          const isSelected = yr === selectedYear;
          return (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400 dark:ring-amber-500'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>{yr}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isSelected 
                  ? 'bg-white/25 text-white' 
                  : count > 0 
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300' 
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter, Search, and Year Summary Stats Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`ค้นหาชื่อหรือวันที่ของปี ${selectedYear}...`}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold px-2">
          <span>รวมวันหยุดปี {selectedYear}: <strong className="text-slate-800 dark:text-white font-black">{yearHolidays.length} วัน</strong></span>
          {yearHolidays.length > 0 && (
            <span className="text-[11px] text-slate-400">
              (นักขัตฤกษ์ {publicCount} • บริษัท {companyCount} {specialCount > 0 && `• พิเศษ ${specialCount}`})
            </span>
          )}
        </div>
      </div>

      {/* Holiday Cards / List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {filteredHolidays.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-400 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <CalendarDays className="w-7 h-7 opacity-80" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-200">
                ยังไม่มีรายการวันหยุดสำหรับปี {selectedYear}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                {copyCheck.canCopy 
                  ? `สามารถสร้างข้อมูลเริ่มต้นโดยคัดลอกจากปี ${copyCheck.sourceYear} (${copyCheck.sourceCount} วัน) หรือเพิ่มรายการใหม่ด้วยตนเอง`
                  : `กรุณากดปุ่มด้านล่างเพื่อเพิ่มวันหยุดของปี ${selectedYear}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {copyCheck.canCopy && onCopyHolidaysFromYear && (
                <button
                  onClick={handleOpenCopyModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  <Copy className="w-4 h-4" />
                  <span>สร้างวันหยุดประจำปี {selectedYear} จากปี {copyCheck.sourceYear}</span>
                </button>
              )}

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มวันหยุดใหม่ด้วยตนเอง</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredHolidays.map((h) => {
              const d = new Date(h.date + 'T00:00:00');
              const dateThai = d.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              });

              return (
                <div
                  key={h.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Day / Month Box */}
                    <div className="text-center min-w-[50px] sm:min-w-[55px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
                        {d.toLocaleDateString('th-TH', { month: 'short' })}
                      </span>
                      <span className="text-lg font-black text-amber-900 dark:text-amber-300 block leading-tight">
                        {d.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                          {h.name}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          h.type === 'COMPANY'
                            ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : h.type === 'SPECIAL'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}>
                          {h.type === 'COMPANY' ? 'วันหยุดบริษัท' : h.type === 'SPECIAL' ? 'วันหยุดพิเศษ' : 'วันหยุดนักขัตฤกษ์'}
                        </span>

                        {h.sourceYear && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700" title={`คัดลอกตั้งต้นมาจากปี ${h.sourceYear}`}>
                            (ต้นแบบปี {h.sourceYear})
                          </span>
                        )}

                        {h.isCustom && !h.sourceYear && (
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold">
                            (กำหนดเอง)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {dateThai} <span className="font-mono text-[11px] text-slate-400">({h.date})</span>
                      </p>

                      {h.note && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800 inline-block mt-0.5">
                          {h.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => handleOpenEdit(h)}
                      className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="แก้ไขวันหยุด"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingHoliday(h)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="ลบวันหยุด"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Copy From Previous Year Confirmation Modal (Requirements 1, 2, 3) */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-emerald-200" />
                <h3 className="text-base font-bold">
                  สร้างวันหยุดประจำปี {selectedYear} จากปีก่อนหน้า
                </h3>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Template Year Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  เลือกปีต้นแบบ (Template Source Year)
                </label>
                <select
                  value={selectedSourceYear || (selectedYear - 1)}
                  onChange={(e) => setSelectedSourceYear(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {candidateSourceYears.map((yr) => {
                    const c = filterHolidaysByYear(holidays, yr).length;
                    return (
                      <option key={yr} value={yr}>
                        ปี ค.ศ. {yr} ({c} รายการ) {yr === selectedYear - 1 ? '- ปีก่อนหน้า (แนะนำ)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Notice & Safety Warning */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>คำแนะนำสำคัญก่อนคัดลอก:</span>
                </div>
                <ul className="text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
                  <li>ระบบจะคัดลอกรายการวันหยุดทั้งหมดของปีต้นแบบมาเป็นข้อมูลเริ่มต้นของปี {selectedYear}</li>
                  <li>รายการที่คัดลอกจะได้รับ <strong>Holiday ID ใหม่ทั้งหมด</strong> และเป็นข้อมูลอิสระของปี {selectedYear}</li>
                  <li><strong>การแก้ไขหรือลบในปี {selectedYear} จะไม่กระทบข้อมูลของปีต้นแบบเด็ดขาด</strong></li>
                  <li>วันหยุดตามปฏิทินจันทรคติ (เช่น วันมาฆบูชา, วิสาขบูชา, อาสาฬหบูชา) หรือวันหยุดชดเชย อาจมีวันที่เปลี่ยนแปลง โปรดตรวจเช็คและแก้ไขวันที่หลังคัดลอก</li>
                </ul>
              </div>

              {/* Preview List of Holidays to be copied */}
              {selectedSourceYear && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      รายการที่จะคัดลอก ({filterHolidaysByYear(holidays, selectedSourceYear).length} รายการ):
                    </span>
                    <span className="text-slate-400">
                      เปลี่ยนเป็น พ.ศ. {selectedYear + 543} (ค.ศ. {selectedYear})
                    </span>
                  </div>

                  <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filterHolidaysByYear(holidays, selectedSourceYear).map((item) => {
                      const targetDate = shiftHolidayDateToYear(item.date, selectedYear);
                      return (
                        <div key={item.id} className="p-2.5 flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                            {item.name}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] shrink-0 font-bold">
                            {targetDate}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmCopy}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันสร้างวันหยุดปี {selectedYear}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Holiday Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-600 to-indigo-600 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingHoliday ? 'แก้ไขวันหยุด' : `เพิ่มวันหยุดใหม่ (ปี ค.ศ. ${selectedYear})`}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Duplicate Warning Prompt if found */}
              {duplicateWarning && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 rounded-2xl p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="font-semibold">{duplicateWarning}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAllowDuplicateSubmit(true);
                        setDuplicateWarning(null);
                        // Trigger submit
                        if (editingHoliday) {
                          onUpdateHoliday({
                            ...editingHoliday,
                            name: formName.trim(),
                            date: formDate.trim(),
                            type: formType,
                            note: formNote.trim(),
                          });
                        } else {
                          onAddHoliday({
                            name: formName.trim(),
                            date: formDate.trim(),
                            type: formType,
                            note: formNote.trim(),
                            isCustom: true,
                          });
                        }
                        setIsAddModalOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-sm"
                    >
                      ยืนยันบันทึกซ้ำ
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold"
                    >
                      แก้ไขข้อมูลใหม่
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  ชื่อวันหยุด
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (duplicateWarning) setDuplicateWarning(null);
                  }}
                  placeholder="เช่น วันขึ้นปีใหม่, วันสงกรานต์, วันสถาปนาบริษัท..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  วันที่ (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => {
                    setFormDate(e.target.value);
                    if (duplicateWarning) setDuplicateWarning(null);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {formDate && !formDate.startsWith(String(selectedYear)) && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
                    ⚠️ วันที่ที่ระบุ ({formDate.substring(0, 4)}) ไม่ตรงกับปี {selectedYear} ที่กำลังเลือก
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  ประเภทวันหยุด
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="PUBLIC">วันหยุดนักขัตฤกษ์ / ประเพณี (Public)</option>
                  <option value="COMPANY">วันหยุดพิเศษของบริษัท (Company)</option>
                  <option value="SPECIAL">วันหยุดชดเชย / พิเศษอื่นๆ (Special)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  หมายเหตุ (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="เช่น ชดเชยวันเสาร์, ตามมติ ครม."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                {editingHoliday ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingHoliday(editingHoliday);
                      setIsAddModalOpen(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ลบวันหยุดนี้</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    {editingHoliday ? 'บันทึกการแก้ไข' : 'เพิ่มวันหยุด'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Requirement 4) */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">ยืนยันการลบวันหยุด</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">ลบเฉพาะรายการของปี {selectedYear}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs border border-slate-100 dark:border-slate-700/60 space-y-1">
              <span className="font-bold block text-slate-900 dark:text-white text-sm">
                {deletingHoliday.name}
              </span>
              <span className="text-slate-500 dark:text-slate-400 block">
                วันที่: <strong>{deletingHoliday.date}</strong>
              </span>
              {deletingHoliday.note && (
                <span className="text-slate-400 dark:text-slate-500 block italic">
                  หมายเหตุ: {deletingHoliday.note}
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              * การลบรายการนี้จะไม่ส่งผลกระทบต่อรายการวันหยุดของปีก่อนหน้าหรือปีอื่นๆ
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingHoliday(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteHoliday(deletingHoliday.id);
                  setDeletingHoliday(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบวันหยุด</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
