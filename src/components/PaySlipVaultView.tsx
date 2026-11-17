import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  FileImage,
  FileText,
  Loader2,
  Pencil,
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
import {
  DailyRecord,
  PaySlipAttachment,
  PayrollSettings,
  SalaryIncrementRecord,
} from '../types/overtime';
import {
  calculatePayroll,
  createCycleRecords,
  getEffectiveSalaryForCycle,
} from '../utils/calculator';
import { compressPaySlipImage } from '../utils/imageCompression';
import {
  detectCycleKeyFromFileName,
  isPdfPaySlipFile,
  processPaySlipPdfFile,
} from '../utils/payslipPdfParser';
import {
  PayslipPDFGenerator,
  formatCycleKeyToMonthYear,
  formatCycleMonthYearThai,
  formatPayPeriodThaiLabel,
} from '../utils/PayslipPDFGenerator';
import { useMoneyVisibility } from '../context/MoneyVisibilityContext';

interface PaySlipVaultViewProps {
  paySlips: PaySlipAttachment[];
  allCycleRecords?: Record<string, DailyRecord[]>;
  salaryIncrements?: SalaryIncrementRecord[];
  cycleTaxes?: Record<string, number>;
  settings?: PayrollSettings;
  currentCycleKey: string;
  currentCycleNetIncome?: number;
  onSavePaySlip: (slip: PaySlipAttachment) => Promise<void> | void;
  onDeletePaySlip: (slipId: string) => Promise<void> | void;
  onUpdateCycleTax?: (cycleKey: string, tax: number, silent?: boolean) => Promise<void> | void;
  onNotify?: (message: string) => void;
}

const MODAL_ZOOM_LEVELS = [100, 150, 200] as const;

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

function parseOptionalNonNegAmount(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.round(num * 100) / 100;
}

function formatAmountInput(val?: number): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '';
  return String(val);
}

export const PaySlipVaultView: React.FC<PaySlipVaultViewProps> = ({
  paySlips,
  allCycleRecords = {},
  salaryIncrements = [],
  cycleTaxes = {},
  settings,
  currentCycleKey,
  onSavePaySlip,
  onDeletePaySlip,
  onUpdateCycleTax,
  onNotify,
}) => {
  const { formatMoney } = useMoneyVisibility();
  const [searchQuery, setSearchQuery] = useState('');
  const [cycleFilter, setCycleFilter] = useState<string>('all');

  // Upload / Edit Modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<PaySlipAttachment | null>(null);
  const [cycleKeyInput, setCycleKeyInput] = useState(() => getDefaultCycleKey(currentCycleKey));
  const [duplicateMode, setDuplicateMode] = useState<'replace' | 'add_new'>('replace');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [imageSizeBytes, setImageSizeBytes] = useState(0);
  const [modalZoomPercent, setModalZoomPercent] = useState<100 | 150 | 200>(100);
  const [baseSalaryInput, setBaseSalaryInput] = useState('');
  const [netIncomeInput, setNetIncomeInput] = useState('');
  const [incomeTaxInput, setIncomeTaxInput] = useState('');
  const [socialSecurityInput, setSocialSecurityInput] = useState('');
  const [autoSyncTaxOnSave, setAutoSyncTaxOnSave] = useState(true);
  const [autoFillNotice, setAutoFillNotice] = useState<string | null>(null);
  const [processingLabel, setProcessingLabel] = useState('กำลังเตรียมไฟล์สลิป...');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Lightbox (View / Zoom / Print), PDF, Sync & Delete state
  const [previewSlip, setPreviewSlip] = useState<PaySlipAttachment | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isPrinting, setIsPrinting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaySlipAttachment | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [syncingTaxSlipId, setSyncingTaxSlipId] = useState<string | null>(null);

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

  // Existing slips matching the currently selected cycleKey when adding a new slip
  const existingSlipsForCycle = useMemo(() => {
    if (editingSlip) return [];
    const cleanCycleKey = cycleKeyInput.trim();
    if (!/^\d{4}-\d{2}$/.test(cleanCycleKey)) return [];
    return paySlips
      .filter((s) => s.cycleKey === cleanCycleKey)
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  }, [editingSlip, cycleKeyInput, paySlips]);

  const primaryExistingSlipForCycle = existingSlipsForCycle[0] || null;

  const openUploadModal = () => {
    setEditingSlip(null);
    setCycleKeyInput(getDefaultCycleKey(currentCycleKey));
    setDuplicateMode('replace');
    setImagePreviewUrl('');
    setImageFileName('');
    setImageMimeType('image/jpeg');
    setImageSizeBytes(0);
    setModalZoomPercent(100);
    setBaseSalaryInput('');
    setNetIncomeInput('');
    setIncomeTaxInput('');
    setSocialSecurityInput('');
    setAutoSyncTaxOnSave(true);
    setAutoFillNotice(null);
    setProcessingLabel('กำลังเตรียมไฟล์สลิป...');
    setIsProcessingFile(false);
    setIsSaving(false);
    setIsDragging(false);
    setFormError(null);
    setIsUploadModalOpen(true);
  };

  const openEditModal = (slip: PaySlipAttachment) => {
    setEditingSlip(slip);
    setCycleKeyInput(getDefaultCycleKey(slip.cycleKey));
    setDuplicateMode('replace');
    setImagePreviewUrl(slip.imageDataUrl || '');
    setImageFileName(slip.fileName || '');
    setImageMimeType(slip.mimeType || 'image/jpeg');
    setImageSizeBytes(slip.fileSizeBytes || 0);
    setModalZoomPercent(100);
    setBaseSalaryInput(formatAmountInput(slip.baseSalary));
    setNetIncomeInput(formatAmountInput(slip.netIncome));
    setIncomeTaxInput(formatAmountInput(slip.incomeTax));
    setSocialSecurityInput(formatAmountInput(slip.socialSecurity));
    setAutoSyncTaxOnSave(true);
    setAutoFillNotice(null);
    setProcessingLabel('กำลังเตรียมไฟล์สลิป...');
    setIsProcessingFile(false);
    setIsSaving(false);
    setIsDragging(false);
    setFormError(null);
    setIsUploadModalOpen(true);
  };

  const handleAmountFocus = (
    currentValue: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    const trimmed = currentValue.trim();
    if (trimmed === '0' || trimmed === '0.00' || trimmed === '0.0') {
      setter('');
      return;
    }
    if (trimmed !== '') {
      e.target.select();
    }
  };

  const handleSelectedFile = async (file: File | undefined | null) => {
    if (!file) return;
    setFormError(null);
    const isPdf = isPdfPaySlipFile(file);
    setProcessingLabel(
      isPdf ? 'กำลังแปลงไฟล์ PDF หน้าแรกเป็นภาพ...' : 'กำลังย่อและเตรียมภาพสลิป...'
    );
    setIsProcessingFile(true);

    try {
      if (isPdf) {
        const pdfRes = await processPaySlipPdfFile(file);
        setImagePreviewUrl(pdfRes.dataUrl);
        setImageFileName(file.name || `payslip_${Date.now()}.pdf`);
        setImageMimeType(pdfRes.mimeType);
        setImageSizeBytes(pdfRes.fileSizeBytes);
        setModalZoomPercent(100);

        if (!editingSlip && pdfRes.detectedCycleKey && /^\d{4}-\d{2}$/.test(pdfRes.detectedCycleKey)) {
          setCycleKeyInput(pdfRes.detectedCycleKey);
          setDuplicateMode('replace');
        }
      } else {
        const compressed = await compressPaySlipImage(file);
        setImagePreviewUrl(compressed.dataUrl);
        setImageFileName(file.name || `payslip_${Date.now()}.jpg`);
        setImageMimeType(compressed.mimeType);
        setImageSizeBytes(compressed.fileSizeBytes);
        setModalZoomPercent(100);

        if (!editingSlip) {
          const detectedFromName = detectCycleKeyFromFileName(file.name);
          if (detectedFromName && /^\d{4}-\d{2}$/.test(detectedFromName)) {
            setCycleKeyInput(detectedFromName);
            setDuplicateMode('replace');
          }
        }
      }
    } catch (err: any) {
      setFormError(
        err?.message ||
          (isPdf
            ? 'ไม่สามารถอ่านไฟล์ PDF ได้ กรุณาตรวจสอบว่าไฟล์ไม่ติดรหัสผ่านหรือลองใหม่อีกครั้ง'
            : 'ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง')
      );
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleAutoFillFromApp = () => {
    setFormError(null);
    if (!settings) {
      setFormError('ไม่พบการตั้งค่าเงินเดือนของแอปสำหรับดึงข้อมูล');
      return;
    }

    const cleanCycleKey = cycleKeyInput.trim();
    const match = /^(\d{4})-(\d{2})$/.exec(cleanCycleKey);
    if (!match) {
      setFormError('กรุณาเลือกรอบเดือนของสลิปให้ถูกต้องก่อนดึงตัวเลข');
      return;
    }

    const year = Number(match[1]);
    const monthIdx = Number(match[2]) - 1;
    const effectiveSalary = getEffectiveSalaryForCycle(
      year,
      monthIdx,
      salaryIncrements,
      settings.baseSalary
    );

    const hasRecordedAttendance = Boolean(
      allCycleRecords[cleanCycleKey] && allCycleRecords[cleanCycleKey].length > 0
    );
    const records = hasRecordedAttendance
      ? allCycleRecords[cleanCycleKey]
      : createCycleRecords(year, monthIdx, settings);

    const recordedTax = Math.round(Math.max(0, Number(cycleTaxes[cleanCycleKey]) || 0) * 100) / 100;
    const summary = calculatePayroll(records, {
      ...settings,
      baseSalary: effectiveSalary,
      taxPaid: recordedTax,
    });

    const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

    setBaseSalaryInput(String(round2(effectiveSalary)));
    setNetIncomeInput(String(round2(summary.netIncome)));
    setIncomeTaxInput(String(recordedTax));
    setSocialSecurityInput(String(round2(summary.socialSecurityAmount)));

    setAutoFillNotice(
      hasRecordedAttendance
        ? `ดึงตัวเลขจากบันทึกเวลาทำงานจริงรอบ ${cleanCycleKey} เรียบร้อยแล้ว สามารถแก้ไขตัวเลขให้ตรงกับสลิปจริงได้ทันที`
        : `ดึงตัวเลขจากตารางกะมาตรฐานรอบ ${cleanCycleKey} เรียบร้อยแล้ว (ยังไม่มีบันทึก OT/ลา รายวัน) สามารถแก้ไขให้ตรงกับสลิปจริงได้`
    );
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!imagePreviewUrl) {
      setFormError('กรุณาถ่ายภาพหรือเลือกไฟล์สลิปเงินเดือน (JPG, PNG หรือ PDF)');
      return;
    }

    const cleanCycleKey = cycleKeyInput.trim();
    if (!/^\d{4}-\d{2}$/.test(cleanCycleKey)) {
      setFormError('กรุณาเลือกรอบเดือนของสลิปให้ถูกต้อง');
      return;
    }

    const parsedBaseSalary = parseOptionalNonNegAmount(baseSalaryInput);
    const parsedNetIncome = parseOptionalNonNegAmount(netIncomeInput);
    const parsedIncomeTax = parseOptionalNonNegAmount(incomeTaxInput);
    const parsedSocialSecurity = parseOptionalNonNegAmount(socialSecurityInput);

    const targetToOverwrite =
      editingSlip || (duplicateMode === 'replace' ? primaryExistingSlipForCycle : null);

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const slipPayload: PaySlipAttachment = {
        id:
          targetToOverwrite?.id ||
          `slip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        cycleKey: cleanCycleKey,
        payPeriodLabel: formatPayPeriodThaiLabel(cleanCycleKey),
        imageDataUrl: imagePreviewUrl,
        ...(parsedBaseSalary !== undefined ? { baseSalary: parsedBaseSalary } : {}),
        ...(parsedNetIncome !== undefined ? { netIncome: parsedNetIncome } : {}),
        ...(parsedIncomeTax !== undefined ? { incomeTax: parsedIncomeTax } : {}),
        ...(parsedSocialSecurity !== undefined ? { socialSecurity: parsedSocialSecurity } : {}),
        fileName: (imageFileName || `payslip_${cleanCycleKey}.jpg`).slice(0, 150),
        mimeType: imageMimeType,
        fileSizeBytes: imageSizeBytes,
        createdAt: targetToOverwrite?.createdAt || nowIso,
        updatedAt: nowIso,
        downloadCount: targetToOverwrite?.downloadCount ?? 0,
        ...(targetToOverwrite?.lastDownloadedAt
          ? { lastDownloadedAt: targetToOverwrite.lastDownloadedAt }
          : {}),
      };

      await onSavePaySlip(slipPayload);

      if (previewSlip && previewSlip.id === slipPayload.id) {
        setPreviewSlip(slipPayload);
      }

      const shouldSyncTax =
        autoSyncTaxOnSave &&
        onUpdateCycleTax &&
        parsedIncomeTax !== undefined &&
        (parsedIncomeTax > 0 || Boolean(targetToOverwrite));

      if (shouldSyncTax && parsedIncomeTax !== undefined) {
        await onUpdateCycleTax(cleanCycleKey, parsedIncomeTax, true);
        if (onNotify) {
          onNotify(
            `${
              targetToOverwrite ? 'อัปเดตสลิป' : 'บันทึกสลิป'
            }และซิงค์ภาษีหัก ณ ที่จ่ายรอบ ${cleanCycleKey} (${formatMoney(parsedIncomeTax)}) เรียบร้อยแล้ว`
          );
        }
      } else if (onNotify) {
        onNotify(
          targetToOverwrite
            ? `บันทึกการแก้ไขสลิปรอบ ${cleanCycleKey} เรียบร้อยแล้ว`
            : `บันทึกสลิปรอบ ${cleanCycleKey} เรียบร้อยแล้ว`
        );
      }

      setIsUploadModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกสลิปเงินเดือน');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncSingleSlipTax = async (slip: PaySlipAttachment) => {
    if (!onUpdateCycleTax || syncingTaxSlipId) return;
    if (typeof slip.incomeTax !== 'number' || !Number.isFinite(slip.incomeTax) || slip.incomeTax < 0) {
      return;
    }
    const cleanTax = Math.round(slip.incomeTax * 100) / 100;
    setSyncingTaxSlipId(slip.id);
    try {
      await onUpdateCycleTax(slip.cycleKey, cleanTax, true);
      if (onNotify) {
        onNotify(
          `ซิงค์ภาษีหัก ณ ที่จ่ายรอบ ${slip.cycleKey} (${formatMoney(cleanTax)}) เข้าสู่ระบบภาษีประจำปีแล้ว`
        );
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify(err?.message || 'ไม่สามารถซิงค์ยอดภาษีได้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setSyncingTaxSlipId(null);
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

  const isOverwriteMode = Boolean(
    editingSlip || (!editingSlip && duplicateMode === 'replace' && primaryExistingSlipForCycle)
  );

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
            อัปโหลดไฟล์ PDF หรือถ่ายภาพสลิปเก็บไว้แยกตามรอบเดือน พร้อมกรอกหรือดึงตัวเลขหลักจากแอปเพื่อซิงค์ภาษีและส่งออก PDF ขนาด A4
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
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline self-start sm:self-center whitespace-nowrap shrink-0 cursor-pointer"
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
              กดปุ่ม &ldquo;เพิ่มสลิปเงินเดือน&rdquo; เพื่ออัปโหลดไฟล์ PDF หรือถ่ายภาพสลิปเก็บไว้เปิดดู แก้ไขตัวเลข และดาวน์โหลดเป็นไฟล์ PDF ได้ทันที
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
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            แสดงรายการทั้งหมด
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1040px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4 w-28">ตัวอย่างสลิป</th>
                  <th className="py-3 px-3">รอบเดือน</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">
                    เงินเดือน <span className="text-[10px] font-mono text-slate-400">(ACT_BASE_SALARY)</span>
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">
                    หักภาษี <span className="text-[10px] font-mono text-slate-400">(INCOME_TAX)</span>
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">
                    หักประกันสังคม <span className="text-[10px] font-mono text-slate-400">(INSU_DEDU)</span>
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">
                    รายรับสุทธิ <span className="text-[10px] font-mono text-slate-400">(ACT_INCOME)</span>
                  </th>
                  <th className="py-3 px-3 w-40">วันที่บันทึก</th>
                  <th className="py-3 px-4 text-right w-72">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredSlips.map((slip, index) => {
                  const isPdfBusy = generatingPdfId === slip.id;
                  const periodTitle = slip.payPeriodLabel || formatPayPeriodThaiLabel(slip.cycleKey);
                  const monthYearCode = formatCycleKeyToMonthYear(slip.cycleKey);
                  const sizeText = formatFileSize(slip.fileSizeBytes);
                  const isPdfSource = (slip.fileName || '').toLowerCase().endsWith('.pdf');

                  return (
                    <tr
                      key={slip.id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Thumbnail & Row Number */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
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
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {periodTitle}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono tabular-nums whitespace-nowrap">
                          <span>{monthYearCode}</span>
                          {isPdfSource && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">PDF</span>
                            </>
                          )}
                          {sizeText && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{sizeText}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Base Salary (ACT_BASE_SALARY) */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {typeof slip.baseSalary === 'number' ? formatMoney(slip.baseSalary) : '-'}
                      </td>

                      {/* Income Tax (INCOME_TAX) & Annual Tax Sync Status */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-mono tabular-nums text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400">
                          {typeof slip.incomeTax === 'number' ? formatMoney(slip.incomeTax) : '-'}
                        </div>
                        {typeof slip.incomeTax === 'number' && slip.incomeTax > 0 && (() => {
                          const recordedTax = Math.round((Number(cycleTaxes[slip.cycleKey]) || 0) * 100) / 100;
                          const isMatched = Math.abs(Math.round((slip.incomeTax - recordedTax) * 100) / 100) < 0.01;
                          if (isMatched) {
                            return (
                              <div
                                title="ยอดภาษีหัก ณ ที่จ่ายในสลิปตรงกับระบบภาษีประจำปีแล้ว"
                                className="mt-0.5 inline-flex items-center justify-end gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                              >
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>ตรงกับระบบภาษี</span>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-1 flex flex-col items-end gap-0.5">
                              {onUpdateCycleTax && (
                                <button
                                  type="button"
                                  disabled={Boolean(syncingTaxSlipId)}
                                  onClick={() => handleSyncSingleSlipTax(slip)}
                                  title={`คลิกเพื่อซิงค์ยอดภาษีเข้าสู่ระบบภาษีประจำปี (ยอดปัจจุบันในระบบภาษี: ${formatMoney(recordedTax)})`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/70 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
                                >
                                  {syncingTaxSlipId === slip.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  <span>ซิงค์เข้าภาษีปี</span>
                                </button>
                              )}
                              {recordedTax > 0 && (
                                <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                                  ในระบบ: {formatMoney(recordedTax)}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Social Security (INSU_DEDU) */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {typeof slip.socialSecurity === 'number' ? formatMoney(slip.socialSecurity) : '-'}
                      </td>

                      {/* Net Income (ACT_INCOME) */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {typeof slip.netIncome === 'number' ? formatMoney(slip.netIncome) : '-'}
                      </td>

                      {/* Saved Date */}
                      <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums whitespace-nowrap">
                        {formatSavedDateTime(slip.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openLightbox(slip)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span>เปิดดู</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(slip)}
                            title="แก้ไขข้อมูลหรือเปลี่ยนภาพสลิป"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>แก้ไข</span>
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(generatingPdfId)}
                            onClick={() => handleDownloadPdf(slip)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isPdfBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            <span>{isPdfBusy ? 'กำลังสร้าง...' : 'โหลด PDF'}</span>
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

      {/* Upload & Edit PaySlip Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingSlip
                    ? `แก้ไขสลิปเงินเดือน (${formatPayPeriodThaiLabel(editingSlip.cycleKey)})`
                    : 'เพิ่มสลิปเงินเดือน (JPG / PNG / PDF)'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingSlip
                    ? 'แก้ไขรอบเดือน ตัวเลข 4 รายการ หรือเปลี่ยนไฟล์ภาพสลิปแล้วบันทึกทับรายการเดิมได้ทันที'
                    : 'อัปโหลดไฟล์ PDF หรือภาพสลิป ขยายภาพดูตัวเลขแล้วกรอกหรือกดดึงตัวเลขจากข้อมูลรอบเดือนในแอป'}
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

            <form onSubmit={handleSaveSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
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
                accept="image/jpeg,image/png,application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  void handleSelectedFile(e.target.files?.[0]);
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
                  void handleSelectedFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {/* Step 1: File Upload (PDF / JPG / PNG) or Camera Capture & Zoomable Preview */}
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
                    void handleSelectedFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                    isDragging
                      ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/30'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40'
                  }`}
                >
                  {isProcessingFile ? (
                    <div className="py-6 flex flex-col items-center gap-2 text-cyan-600 dark:text-cyan-400">
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span className="text-xs font-semibold">{processingLabel}</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 mx-auto flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          เลือกไฟล์ PDF / รูปภาพสลิป หรือถ่ายภาพจากกล้อง
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          รองรับไฟล์ .PDF (แปลงหน้าแรกเป็นภาพคมชัด) และรูปภาพ JPG / PNG พร้อมเดารอบเดือนจากชื่อไฟล์
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>เลือกไฟล์ PDF / รูปภาพ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>ถ่ายภาพสลิป</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-2.5">
                  {/* Preview Toolbar: Zoom Toggle & File Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                      <span className="px-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>ซูมดูตัวเลข:</span>
                      </span>
                      {MODAL_ZOOM_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setModalZoomPercent(level)}
                          className={`px-2 py-1 rounded-md font-mono font-semibold tabular-nums transition-colors cursor-pointer ${
                            modalZoomPercent === level
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {level}%
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
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
                        <span>เปลี่ยนไฟล์</span>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable & Zoomable Slip Image Preview */}
                  <div className="relative rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-72 sm:max-h-80 overflow-auto p-2">
                    <div
                      className={
                        modalZoomPercent === 100
                          ? 'flex items-center justify-center'
                          : 'min-w-full inline-block'
                      }
                    >
                      <img
                        src={imagePreviewUrl}
                        alt="ตัวอย่างภาพสลิปเงินเดือน"
                        onClick={() =>
                          setModalZoomPercent((prev) =>
                            prev === 100 ? 150 : prev === 150 ? 200 : 100
                          )
                        }
                        title="คลิกที่ภาพเพื่อสลับขนาดซูม 100% / 150% / 200%"
                        style={
                          modalZoomPercent === 100
                            ? undefined
                            : { width: `${modalZoomPercent}%`, maxWidth: 'none' }
                        }
                        className={
                          modalZoomPercent === 100
                            ? 'block max-h-68 sm:max-h-76 w-auto h-auto object-contain select-none cursor-zoom-in rounded-lg'
                            : 'block h-auto select-none cursor-zoom-out rounded-lg'
                        }
                      />
                    </div>

                    {isProcessingFile && (
                      <div className="absolute inset-0 bg-slate-950/65 flex flex-col items-center justify-center gap-2 text-white text-xs font-semibold px-4 text-center">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>{processingLabel}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate max-w-[300px]">
                      {imageFileName || 'ภาพสลิปเงินเดือน'}
                      {imageSizeBytes > 0 ? ` · ${formatFileSize(imageSizeBytes)}` : ''}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {modalZoomPercent > 100
                        ? 'เลื่อนภาพในกรอบเพื่ออ่านตัวเลข (คลิกที่ภาพเพื่อย่อ)'
                        : 'คลิกที่ภาพหรือกดปุ่ม 150% / 200% เพื่อขยายอ่านตัวเลข'}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 2: Cycle Month/Year Picker + Duplicate Cycle Choice */}
              <div className="space-y-2.5">
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
                    onChange={(e) => {
                      setCycleKeyInput(e.target.value);
                      setDuplicateMode('replace');
                      setAutoFillNotice(null);
                    }}
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

                {/* Duplicate Cycle Warning & Choice (only in Add mode) */}
                {!editingSlip && primaryExistingSlipForCycle && (
                  <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 space-y-2.5">
                    <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <span className="font-semibold">
                          พบบันทึกสลิปของ {formatPayPeriodThaiLabel(cycleKeyInput)} อยู่แล้ว (
                          {existingSlipsForCycle.length} ใบ)
                        </span>
                        <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                          คุณต้องการบันทึกทับสลิปเดิมของเดือนนี้ หรือบันทึกเพิ่มเป็นอีกใบ?
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          duplicateMode === 'replace'
                            ? 'border-amber-500 bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-200 shadow-xs'
                            : 'border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payslip-duplicate-mode"
                          checked={duplicateMode === 'replace'}
                          onChange={() => setDuplicateMode('replace')}
                          className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>บันทึกทับสลิปเดิมของเดือนนี้</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          duplicateMode === 'add_new'
                            ? 'border-cyan-500 bg-white dark:bg-slate-900 text-cyan-800 dark:text-cyan-200 shadow-xs'
                            : 'border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payslip-duplicate-mode"
                          checked={duplicateMode === 'add_new'}
                          onChange={() => setDuplicateMode('add_new')}
                          className="text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span>บันทึกเพิ่มอีกใบ</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Manual 4 Key Payroll Figures + Auto-Fill Button */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                      ข้อมูลตัวเลขหลัก 4 รายการ (บาท / THB)
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      กรอกตามสลิปจริง หรือกดดึงตัวเลขจากแอปแล้วปรับแก้ให้ตรง
                    </span>
                  </div>

                  {settings && (
                    <button
                      type="button"
                      onClick={handleAutoFillFromApp}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-200 dark:border-cyan-800/70 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ดึงตัวเลขจากข้อมูลรอบเดือนในแอป</span>
                    </button>
                  )}
                </div>

                {autoFillNotice && (
                  <div className="p-2.5 rounded-xl bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50 text-[11px] text-cyan-800 dark:text-cyan-200 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
                    <span>{autoFillNotice}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="payslip-base-salary"
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                      1. รายได้ / เงินเดือน{' '}
                      <span className="font-mono text-[10px] text-slate-400">(ACT_BASE_SALARY)</span>
                    </label>
                    <input
                      id="payslip-base-salary"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={baseSalaryInput}
                      onFocus={(e) => handleAmountFocus(baseSalaryInput, setBaseSalaryInput, e)}
                      onChange={(e) => setBaseSalaryInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="payslip-net-income"
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                      2. รายรับสุทธิ{' '}
                      <span className="font-mono text-[10px] text-slate-400">(ACT_INCOME)</span>
                    </label>
                    <input
                      id="payslip-net-income"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={netIncomeInput}
                      onFocus={(e) => handleAmountFocus(netIncomeInput, setNetIncomeInput, e)}
                      onChange={(e) => setNetIncomeInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="payslip-income-tax"
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                      3. หักภาษีเงินได้{' '}
                      <span className="font-mono text-[10px] text-slate-400">(INCOME_TAX)</span>
                    </label>
                    <input
                      id="payslip-income-tax"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={incomeTaxInput}
                      onFocus={(e) => handleAmountFocus(incomeTaxInput, setIncomeTaxInput, e)}
                      onChange={(e) => setIncomeTaxInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="payslip-social-security"
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                      4. หักประกันสังคม{' '}
                      <span className="font-mono text-[10px] text-slate-400">(INSU_DEDU)</span>
                    </label>
                    <input
                      id="payslip-social-security"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={socialSecurityInput}
                      onFocus={(e) =>
                        handleAmountFocus(socialSecurityInput, setSocialSecurityInput, e)
                      }
                      onChange={(e) => setSocialSecurityInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                    />
                  </div>
                </div>

                {/* Auto-sync INCOME_TAX toggle on save */}
                {onUpdateCycleTax && (
                  <label
                    htmlFor="payslip-autosync-tax"
                    className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:border-cyan-300 dark:hover:border-cyan-700/70 transition-colors cursor-pointer select-none"
                  >
                    <input
                      id="payslip-autosync-tax"
                      type="checkbox"
                      checked={autoSyncTaxOnSave}
                      onChange={(e) => setAutoSyncTaxOnSave(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        ซิงค์ยอดภาษีหัก ณ ที่จ่าย (<span className="font-mono">INCOME_TAX</span>) เข้าสู่ระบบภาษีประจำปีของรอบเดือนนี้อัตโนมัติ
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {(() => {
                          const previewTax = parseOptionalNonNegAmount(incomeTaxInput);
                          if (previewTax !== undefined && (previewTax > 0 || isOverwriteMode)) {
                            return `เมื่อกดบันทึก จะอัปเดตยอดภาษีรอบ ${cycleKeyInput} เป็น ${formatMoney(previewTax)} ให้อัตโนมัติ`;
                          }
                          return 'ระบบจะอัปเดตยอดภาษีหัก ณ ที่จ่ายของรอบเดือนนี้ให้อัตโนมัติเมื่อมียอดมากกว่า 0 บาท';
                        })()}
                      </p>
                    </div>
                  </label>
                )}
              </div>

              {/* Step 4: Modal Actions */}
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
                  disabled={isSaving || isProcessingFile || !imagePreviewUrl}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isSaving
                      ? 'กำลังบันทึก...'
                      : editingSlip
                      ? 'บันทึกการแก้ไข'
                      : duplicateMode === 'replace' && primaryExistingSlipForCycle
                      ? 'บันทึกทับสลิปเดิม'
                      : 'บันทึกสลิป'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Viewer (Zoom & Print & Edit & PDF) */}
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
                  onClick={() => {
                    const target = previewSlip;
                    setPreviewSlip(null);
                    openEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>แก้ไข</span>
                </button>

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

            {/* Saved Summary Strip in Lightbox */}
            {(typeof previewSlip.baseSalary === 'number' ||
              typeof previewSlip.netIncome === 'number' ||
              typeof previewSlip.incomeTax === 'number' ||
              typeof previewSlip.socialSecurity === 'number') && (
              <div className="px-4 py-2.5 bg-slate-800/95 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">เงินเดือน (ACT_BASE_SALARY)</span>
                  <span className="font-bold font-mono tabular-nums text-white">
                    {typeof previewSlip.baseSalary === 'number' ? formatMoney(previewSlip.baseSalary) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">หักภาษี (INCOME_TAX)</span>
                  <span className="font-bold font-mono tabular-nums text-rose-300">
                    {typeof previewSlip.incomeTax === 'number' ? formatMoney(previewSlip.incomeTax) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">หักประกันสังคม (INSU_DEDU)</span>
                  <span className="font-bold font-mono tabular-nums text-amber-300">
                    {typeof previewSlip.socialSecurity === 'number' ? formatMoney(previewSlip.socialSecurity) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">รายรับสุทธิ (ACT_INCOME)</span>
                  <span className="font-bold font-mono tabular-nums text-emerald-300">
                    {typeof previewSlip.netIncome === 'number' ? formatMoney(previewSlip.netIncome) : '-'}
                  </span>
                </div>
              </div>
            )}

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
