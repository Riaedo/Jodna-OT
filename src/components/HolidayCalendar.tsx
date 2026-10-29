import React, { useState } from 'react';
import { Holiday } from '../types/overtime';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  CalendarCheck, 
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface HolidayCalendarProps {
  holidays: Holiday[];
  onAddHoliday: (holiday: Omit<Holiday, 'id'>) => void;
  onUpdateHoliday: (holiday: Holiday) => void;
  onDeleteHoliday: (id: string) => void;
  onApplyToCurrentCycle: () => void;
}

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({
  holidays,
  onAddHoliday,
  onUpdateHoliday,
  onDeleteHoliday,
  onApplyToCurrentCycle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<'PUBLIC' | 'COMPANY' | 'SPECIAL'>('PUBLIC');

  // Filter holidays by selected year and search term
  const yearStr = String(selectedYear);
  const filteredHolidays = holidays.filter((h) => {
    const matchesYear = h.date.startsWith(yearStr);
    const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.date.includes(searchTerm);
    return matchesYear && matchesSearch;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const handleOpenAdd = () => {
    setEditingHoliday(null);
    setFormName('');
    setFormDate('');
    setFormType('COMPANY');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setFormName(h.name);
    setFormDate(h.date);
    setFormType(h.type || 'PUBLIC');
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formDate) return;

    if (editingHoliday) {
      onUpdateHoliday({
        ...editingHoliday,
        name: formName,
        date: formDate,
        type: formType,
      });
    } else {
      onAddHoliday({
        name: formName,
        date: formDate,
        type: formType,
        isCustom: true,
      });
    }
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* 12: Header Banner with Prominent Year Selector */}
      <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 dark:from-amber-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 rounded-3xl p-5 sm:p-6 border border-amber-500/30 dark:border-amber-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <span className="text-xs uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">
              จัดการปฏิทินวันหยุดรายปี
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-2">
            วันหยุดประจำปี ค.ศ. {selectedYear}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            แสดงรายการวันหยุดแยกรายปีอย่างชัดเจน • กำหนดวันหยุดเองได้ และนำไปบันทึกสถานะวันหยุด (H) ในรอบวิกได้ทันที
          </p>
        </div>

        {/* 12: Year Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-sm shrink-0">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
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
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="ปีถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <button
              onClick={onApplyToCurrentCycle}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
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

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`ค้นหาชื่อวันหยุดของปี ${selectedYear}...`}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold px-2">
          <span>รวมวันหยุดปี {selectedYear}: <strong>{filteredHolidays.length} วัน</strong></span>
        </div>
      </div>

      {/* Holiday Cards / List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredHolidays.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">ไม่พบรายการวันหยุดสำหรับปี {selectedYear}</p>
              <button
                onClick={handleOpenAdd}
                className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold"
              >
                + เพิ่มวันหยุดใหม่ของปี {selectedYear}
              </button>
            </div>
          ) : (
            filteredHolidays.map((h) => {
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
                    <div className="text-center min-w-[50px] sm:min-w-[55px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
                        {d.toLocaleDateString('th-TH', { month: 'short' })}
                      </span>
                      <span className="text-lg font-black text-amber-900 dark:text-amber-300 block leading-tight">
                        {d.getDate()}
                      </span>
                    </div>

                    <div>
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
                        {h.isCustom && (
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold">
                            (กำหนดเอง)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {dateThai} ({h.date})
                      </p>
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
            })
          )}
        </div>
      </div>

      {/* Add / Edit Holiday Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-600 to-indigo-600 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingHoliday ? 'แก้ไขวันหยุด' : `เพิ่มวันหยุดใหม่ (ปี ${selectedYear})`}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  ชื่อวันหยุด
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น วันหยุดประจำปีบริษัท, วันสถาปนา..."
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
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
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
                  <option value="PUBLIC">วันหยุดนักขัตฤกษ์ / ประเพณี</option>
                  <option value="COMPANY">วันหยุดพิเศษของบริษัท</option>
                  <option value="SPECIAL">วันหยุดชดเชย / อื่นๆ</option>
                </select>
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
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20"
                  >
                    {editingHoliday ? 'บันทึกการแก้ไข' : 'เพิ่มวันหยุด'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-UI Delete Confirmation Modal */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">ยืนยันการลบวันหยุด</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">รายการนี้จะถูกลบออกจากปฏิทิน</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs border border-slate-100 dark:border-slate-700/60 space-y-1">
              <span className="font-bold block text-slate-900 dark:text-white text-sm">
                {deletingHoliday.name}
              </span>
              <span className="text-slate-500 dark:text-slate-400 block">
                วันที่: <strong>{deletingHoliday.date}</strong>
              </span>
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
