import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  Eye,
  FileDown,
  FileImage,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PaySlipAttachment, PayrollSettings } from '../types/overtime';
import { compressPaySlipImage } from '../utils/imageCompression';
import {
  PayslipPDFGenerator,
  formatCycleKeyToMonthYear,
  formatCycleMonthYearThai,
  formatPayPeriodThaiLabel,
} from '../utils/PayslipPDFGenerator';

interface PaySlipVaultViewProps {
  paySlips: PaySlipAttachment[];
  settings?: PayrollSettings;
  currentCycleKey: string;
  currentCycleNetIncome?: number;
  onSavePaySlip: (slip: PaySlipAttachment) => Promise<void> | void;
  onDeletePaySlip: (slipId: string) => Promise<void> | void;
  onNotify?: (message: string) => void;
}

function getDefaultCycleKey(rawCycleKey?: string): string {
  if (rawCycleKey && /^\d{4}-\d{2}$/.test(rawCycleKey.trim())) {
    return rawCycleKey.trim();
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatSavedDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

export const PaySlipVaultView: React.FC<PaySlipVaultViewProps> = ({
  paySlips,
  currentCycleKey,
  onSavePaySlip,
  onDeletePaySlip,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cycleFilter, setCycleFilter] = useState<string>('all');

  // Simple Upload & Save modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [cycleKeyInput, setCycleKeyInput] = useState(() => getDefaultCycleKey(currentCycleKey));
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [imageSizeBytes, setImageSizeBytes] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Lightbox (View / Zoom / Print), PDF & Delete state
  const [previewSlip, setPreviewSlip] = useState<PaySlipAttachment | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isPrinting, setIsPrinting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaySlipAttachment | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const availableCycles = useMemo(() => {
    const set = new Set<string>();
    paySlips.forEach((s) => {
      if (s.cycleKey) set.add(s.cycleKey);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [paySlips]);

  const filteredSlips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...paySlips]
      .sort((a, b) => {
        const cycleCmp = (b.cycleKey || '').localeCompare(a.cycleKey || '');
        if (cycleCmp !== 0) return cycleCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      })
      .filter((s) => {
        if (cycleFilter !== 'all' && s.cycleKey !== cycleFilter) return false;
        if (!q) return true;
        const periodLabel = s.payPeriodLabel || formatPayPeriodThaiLabel(s.cycleKey);
        return (
          (s.cycleKey || '').toLowerCase().includes(q) ||
          periodLabel.toLowerCase().includes(q) ||
          formatCycleKeyToMonthYear(s.cycleKey).toLowerCase().includes(q)
        );
      });
  }, [paySlips, cycleFilter, searchQuery]);

  const openUploadModal = () => {
    setCycleKeyInput(getDefaultCycleKey(currentCycleKey));
    setImagePreviewUrl('');
    setImageFileName('');
    setImageMimeType('image/jpeg');
    setImageSizeBytes(0);
    setIsCompressing(false);
    setIsSaving(false);
    setIsDragging(false);
    setFormError(null);
    setIsUploadModalOpen(true);
  };

  const handleSelectedImageFile = async (file: File | undefined | null) => {
    if (!file) return;
    setFormError(null);
    setIsCompressing(true);

    try {
      const compressed = await compressPaySlipImage(file);
      setImagePreviewUrl(compressed.dataUrl);
      setImageFileName(file.name || `payslip_${Date.now()}.jpg`);
      setImageMimeType(compressed.mimeType);
      setImageSizeBytes(compressed.fileSizeBytes);
    } catch (err: any) {
      setFormError(err?.message || 'ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!imagePreviewUrl) {
      setFormError('กรุณาถ่ายภาพหรือเลือกรูปสลิปเงินเดือน (JPG หรือ PNG)');
      return;
    }

    const cleanCycleKey = cycleKeyInput.trim();
    if (!/^\d{4}-\d{2}$/.test(cleanCycleKey)) {
      setFormError('กรุณาเลือกรอบเดือนของสลิปให้ถูกต้อง');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const newSlip: PaySlipAttachment = {
        id: `slip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        cycleKey: cleanCycleKey,
        payPeriodLabel: formatPayPeriodThaiLabel(cleanCycleKey),
        imageDataUrl: imagePreviewUrl,
        fileName: (imageFileName || `payslip_${cleanCycleKey}.jpg`).slice(0, 150),
        mimeType: imageMimeType,
        fileSizeBytes: imageSizeBytes,
        createdAt: nowIso,
        updatedAt: nowIso,
        downloadCount: 0,
      };

      await onSavePaySlip(newSlip);
      setIsUploadModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกสลิปเงินเดือน');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async (slip: PaySlipAttachment) => {
    if (generatingPdfId) return;
    setGeneratingPdfId(slip.id);
    try {
      const { fileName } = await PayslipPDFGenerator.generateSimpleImagePdf(slip);
      const nowIso = new Date().toISOString();
      const updatedSlip: PaySlipAttachment = {
        ...slip,
        payPeriodLabel: slip.payPeriodLabel || formatPayPeriodThaiLabel(slip.cycleKey),
        downloadCount: (Number(slip.downloadCount) || 0) + 1,
        lastDownloadedAt: nowIso,
        updatedAt: nowIso,
      };
      await onSavePaySlip(updatedSlip);
      if (previewSlip?.id === slip.id) {
        setPreviewSlip(updatedSlip);
      }
      if (onNotify) {
        onNotify(`ดาวน์โหลด PDF "${fileName}" สำเร็จ`);
      }
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      if (onNotify) {
        onNotify(err?.message || 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF');
      }
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const openLightbox = (slip: PaySlipAttachment) => {
    setZoomPercent(100);
    setPreviewSlip(slip);
  };

  const handlePrintSlipImage = async (slip: PaySlipAttachment) => {
    if (isPrinting || !slip.imageDataUrl) return;
    setIsPrinting(true);
    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !iframe.contentWindow) {
        iframe.remove();
        throw new Error('ไม่สามารถเตรียมหน้าสำหรับสั่งพิมพ์ได้');
      }

      doc.open();
      doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${PayslipPDFGenerator.formatSimpleFilename(slip.cycleKey)}</title>
    <style>
      @page { size: A4 portrait; margin: 8mm; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        max-width: 100%;
        max-height: 100vh;
        width: auto;
        height: auto;
        object-fit: contain;
        display: block;
      }
    </style>
  </head>
  <body>
    <img src="${slip.imageDataUrl}" alt="PaySlip" />
  </body>
</html>`);
      doc.close();

      await new Promise<void>((resolve) => {
        const img = doc.querySelector('img');
        if (!img || img.complete) {
          setTimeout(resolve, 120);
          return;
        }
        img.onload = () => setTimeout(resolve, 120);
        img.onerror = () => setTimeout(resolve, 120);
      });

      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2000);
    } catch (err: any) {
      if (onNotify) {
        onNotify(err?.message || 'ไม่สามารถสั่งพิมพ์รูปสลิปได้');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    if (previewSlip?.id === targetId) {
      setPreviewSlip(null);
    }
    await onDeletePaySlip(targetId);
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>คลังเอกสารส่วนตัว</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">บันทึกแล้ว {paySlips.length} รายการ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
            คลังภาพสลิปเงินเดือน &amp; PDF
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            ถ่ายภาพหรืออัปโหลดสลิปเงินเดือนแยกตามรอบเดือน เพื่อเปิดดูย้อนหลังและดาวน์โหลดเป็น PDF ขนาด A4
          </p>
        </div>

        <button
          type="button"
          onClick={openUploadModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มสลิปเงินเดือน</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาตามรอบเดือน (เช่น พฤศจิกายน, 2026-11)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <select
            value={cycleFilter}
            onChange={(e) => setCycleFilter(e.target.value)}
            aria-label="กรองตามรอบเดือน"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">ทุกรอบเดือน ({paySlips.length})</option>
            {availableCycles.map((ck) => (
              <option key={ck} value={ck}>
                {formatPayPeriodThaiLabel(ck)}
              </option>
            ))}
          </select>
        </div>

        {(searchQuery || cycleFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCycleFilter('all');
            }}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline self-start sm:self-center whitespace-nowrap shrink-0"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Primary Table View */}
      {paySlips.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 sm:p-14 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 mx-auto flex items-center justify-center">
            <FileImage className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              ยังไม่มีภาพสลิปเงินเดือนที่บันทึกไว้
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              กดปุ่ม &ldquo;เพิ่มสลิปเงินเดือน&rdquo; เพื่อถ่ายภาพหรือเลือกรูปสลิปพร้อมระบุรอบเดือน เก็บไว้เปิดดูและดาวน์โหลดเป็นไฟล์ PDF ได้ทันที
            </p>
          </div>
          <button
            type="button"
            onClick={openUploadModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสลิปเงินเดือน</span>
          </button>
        </div>
      ) : filteredSlips.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            ไม่พบสลิปที่ตรงกับการค้นหาหรือรอบเดือนที่เลือก
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCycleFilter('all');
            }}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            แสดงรายการทั้งหมด
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4 w-32">ลำดับ / ตัวอย่างสลิป</th>
                  <th className="py-3 px-4">รอบเดือนของสลิป</th>
                  <th className="py-3 px-4 w-48">วันที่บันทึก</th>
                  <th className="py-3 px-4 text-right w-72">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredSlips.map((slip, index) => {
                  const isPdfBusy = generatingPdfId === slip.id;
                  const periodTitle = slip.payPeriodLabel || formatPayPeriodThaiLabel(slip.cycleKey);
                  const monthYearCode = formatCycleKeyToMonthYear(slip.cycleKey);
                  const sizeText = formatFileSize(slip.fileSizeBytes);

                  return (
                    <tr
                      key={slip.id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Thumbnail & Row Number */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold font-mono tabular-nums text-slate-400 dark:text-slate-500 w-5 text-right shrink-0">
                            {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => openLightbox(slip)}
                            title="คลิกเพื่อเปิดดูรูปสลิปขนาดใหญ่"
                            className="group relative w-11 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 cursor-pointer"
                          >
                            <img
                              src={slip.imageDataUrl}
                              alt={periodTitle}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                            />
                          </button>
                        </div>
                      </td>

                      {/* Cycle Month/Year */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {periodTitle}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono tabular-nums">
                          <span>{monthYearCode}</span>
                          {sizeText && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{sizeText}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Saved Date */}
                      <td className="py-3 px-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-mono tabular-nums whitespace-nowrap">
                        {formatSavedDateTime(slip.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openLightbox(slip)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span>เปิดดูรูปสลิป</span>
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(generatingPdfId)}
                            onClick={() => handleDownloadPdf(slip)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isPdfBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            <span>{isPdfBusy ? 'กำลังสร้าง...' : 'ดาวน์โหลด PDF'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(slip)}
                            title="ลบสลิป"
                            aria-label={`ลบสลิป ${periodTitle}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Simple Upload & Save Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  เพิ่มสลิปเงินเดือน
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  อัปโหลดหรือถ่ายภาพสลิปและเลือกรอบเดือนที่ต้องการบันทึก
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Hidden file & camera inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  void handleSelectedImageFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void handleSelectedImageFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {/* Step 1: Image Upload / Camera Capture & Preview */}
              {!imagePreviewUrl ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    void handleSelectedImageFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                    isDragging
                      ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/30'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40'
                  }`}
                >
                  {isCompressing ? (
                    <div className="py-6 flex flex-col items-center gap-2 text-cyan-600 dark:text-cyan-400">
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span className="text-xs font-semibold">กำลังย่อและเตรียมภาพสลิป...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 mx-auto flex items-center justify-center">
                        <FileImage className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          เลือกไฟล์ภาพสลิปหรือถ่ายภาพจากกล้อง
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          รองรับ JPG / PNG หรือลากไฟล์มาวางที่นี่ (ย่อขนาดอัตโนมัติ)
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>ถ่ายภาพสลิป</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>เลือกไฟล์ภาพ</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center max-h-72">
                    <img
                      src={imagePreviewUrl}
                      alt="ตัวอย่างภาพสลิปเงินเดือน"
                      className="max-h-72 w-auto object-contain"
                    />
                    {isCompressing && (
                      <div className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center gap-2 text-white text-xs font-semibold">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>กำลังบีบอัดภาพ...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate max-w-[200px]">
                      {imageFileName}
                      {imageSizeBytes > 0 ? ` · ${formatFileSize(imageSizeBytes)}` : ''}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>ถ่ายใหม่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>เปลี่ยนรูป</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Cycle Month/Year Picker ONLY */}
              <div>
                <label
                  htmlFor="payslip-cycle-input"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>รอบเดือนของสลิป (Cycle Month/Year)</span>
                </label>
                <input
                  id="payslip-cycle-input"
                  type="month"
                  required
                  value={cycleKeyInput}
                  onChange={(e) => setCycleKeyInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono tabular-nums"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  จะบันทึกเป็น:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {formatPayPeriodThaiLabel(cycleKeyInput)}
                  </strong>{' '}
                  <span className="font-mono text-[11px]">
                    ({formatCycleMonthYearThai(cycleKeyInput)})
                  </span>
                </p>
              </div>

              {/* Step 3: Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isCompressing || !imagePreviewUrl}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกสลิป'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Viewer (Zoom & Print & PDF) */}
      {previewSlip && (
        <div
          onClick={() => setPreviewSlip(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[94vh]"
          >
            {/* Lightbox Toolbar */}
            <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800">
              <div className="min-w-0">
                <h4 className="text-sm font-bold truncate">
                  {previewSlip.payPeriodLabel || formatPayPeriodThaiLabel(previewSlip.cycleKey)}
                </h4>
                <p className="text-xs text-slate-400 font-mono tabular-nums truncate">
                  บันทึกเมื่อ {formatSavedDateTime(previewSlip.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Zoom Controls */}
                <div className="inline-flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.max(50, z - 25))}
                    disabled={zoomPercent <= 50}
                    title="ซูมออก"
                    className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomPercent(100)}
                    title="รีเซ็ตขนาด 100%"
                    className="px-2 py-1 text-xs font-mono tabular-nums text-slate-200 hover:text-white cursor-pointer"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.min(250, z + 25))}
                    disabled={zoomPercent >= 250}
                    title="ซูมเข้า"
                    className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={() => handlePrintSlipImage(previewSlip)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isPrinting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  <span>สั่งพิมพ์</span>
                </button>

                <button
                  type="button"
                  disabled={Boolean(generatingPdfId)}
                  onClick={() => handleDownloadPdf(previewSlip)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  {generatingPdfId === previewSlip.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span>ดาวน์โหลด PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewSlip(null)}
                  aria-label="ปิดหน้าต่างดูภาพ"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable & Zoomable Slip Viewport */}
            <div className="p-4 sm:p-6 overflow-auto bg-slate-100 dark:bg-slate-950 flex-1 flex items-center justify-center">
              <img
                src={previewSlip.imageDataUrl}
                alt={previewSlip.payPeriodLabel || formatPayPeriodThaiLabel(previewSlip.cycleKey)}
                style={{
                  width: zoomPercent === 100 ? 'auto' : `${zoomPercent}%`,
                  maxWidth: zoomPercent === 100 ? '100%' : 'none',
                  maxHeight: zoomPercent === 100 ? '74vh' : 'none',
                }}
                onClick={() => setZoomPercent((z) => (z === 100 ? 150 : 100))}
                title="คลิกที่ภาพเพื่อขยาย/ย่อ"
                className="object-contain rounded-xl shadow-lg bg-white cursor-zoom-in transition-all duration-150"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  ยืนยันการลบสลิปเงินเดือน?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  คุณต้องการลบภาพสลิปของ{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {deleteTarget.payPeriodLabel || formatPayPeriodThaiLabel(deleteTarget.cycleKey)}
                  </strong>{' '}
                  ใช่หรือไม่? การลบนี้ไม่สามารถกู้คืนได้
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                ยืนยันลบสลิป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
