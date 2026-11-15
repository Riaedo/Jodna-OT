import React, { useRef, useState } from 'react';
import { PaySlipAttachment, PayrollSettings, PayrollSummary } from '../types/overtime';
import {
  X,
  Printer,
  Copy,
  Check,
  Building2,
  FileText,
  FileImage,
  FileDown,
  Loader2,
  Upload,
} from 'lucide-react';
import { useMoneyVisibility } from '../context/MoneyVisibilityContext';
import { PayslipPDFGenerator } from '../utils/PayslipPDFGenerator';
import { compressPaySlipImage } from '../utils/imageCompression';

interface PaySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PayrollSummary;
  settings: PayrollSettings;
  cycleLabel: string;
  cycleKey?: string;
  attachedSlip?: PaySlipAttachment | null;
  onOpenPaySlipVault?: () => void;
  onNotify?: (message: string) => void;
  onIncrementDownloadCount?: (slip: PaySlipAttachment) => Promise<void> | void;
}

export const PaySlipModal: React.FC<PaySlipModalProps> = ({
  isOpen,
  onClose,
  summary,
  settings,
  cycleLabel,
  cycleKey,
  attachedSlip,
  onOpenPaySlipVault,
  onNotify,
  onIncrementDownloadCount,
}) => {
  const { formatMoney } = useMoneyVisibility();
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [inlineImageDataUrl, setInlineImageDataUrl] = useState<string>('');
  const [inlineImageName, setInlineImageName] = useState<string>('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resolvedCycleKey =
    cycleKey ||
    attachedSlip?.cycleKey ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const effectiveSlip: PaySlipAttachment | null = inlineImageDataUrl
    ? {
        id: attachedSlip?.id || `temp_${Date.now()}`,
        cycleKey: resolvedCycleKey,
        payPeriodLabel: cycleLabel,
        imageDataUrl: inlineImageDataUrl,
        fileName: inlineImageName || 'payslip.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 0,
        createdAt: attachedSlip?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        downloadCount: attachedSlip?.downloadCount || 0,
      }
    : attachedSlip || null;

  const handlePrint = () => {
    window.print();
  };

  const handleInlineImageSelect = async (file: File | undefined | null) => {
    if (!file) return;
    setPdfError(null);
    try {
      const compressed = await compressPaySlipImage(file);
      setInlineImageDataUrl(compressed.dataUrl);
      setInlineImageName(file.name || 'payslip.jpg');
    } catch (err: any) {
      setPdfError(err?.message || 'ไม่สามารถโหลดภาพสลิปได้');
    }
  };

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfError(null);
    try {
      const { fileName } = await PayslipPDFGenerator.generateFromPayrollSummary({
        summary,
        settings,
        cycleKey: resolvedCycleKey,
        cycleLabel,
        attachedSlip: effectiveSlip,
      });

      if (attachedSlip && onIncrementDownloadCount) {
        const nowIso = new Date().toISOString();
        await onIncrementDownloadCount({
          ...attachedSlip,
          downloadCount: (Number(attachedSlip.downloadCount) || 0) + 1,
          lastDownloadedAt: nowIso,
          updatedAt: nowIso,
        });
      }

      if (onNotify) {
        onNotify(`ดาวน์โหลด PDF "${fileName}" สำเร็จ`);
      }
    } catch (err: any) {
      console.error('Failed to generate PDF from PaySlipModal:', err);
      const msg = err?.message || 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF';
      setPdfError(msg);
      if (onNotify) {
        onNotify(msg);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopySummary = () => {
    const text = `📋 ใบแจ้งยอดเงินได้ & สรุป OT ประจำงวด
พนักงาน: ${settings.employeeName} (${settings.department || 'ฝ่ายปฏิบัติการ'})
รอบตัดวิก: ${cycleLabel}
---------------------------------
💰 รวมเงินได้ก่อนหัก: ${formatMoney(summary.totalGrossIncome)}
  • ฐานเงินเดือน: ${formatMoney(settings.baseSalary)}
  • ค่าล่วงเวลา OT (${summary.totalOtHours} ชม.): ${formatMoney(summary.totalOtAmount)}
    - OT 1.5x (${summary.totalOt1_5_hours} ชม.): ${formatMoney(summary.ot1_5_amount)}
    - OT 1.0x (${summary.totalOt1_0_hours} ชม.): ${formatMoney(summary.ot1_0_amount)}
    - OT 3.0x (${summary.totalOt3_0_hours} ชม.): ${formatMoney(summary.ot3_0_amount)}
  • ค่าสวัสดิการ & ค่ากะ: ${formatMoney(summary.totalFixedAllowances + summary.diligenceAmount + summary.shiftAmount)}
---------------------------------
🔻 รายการหัก: ${formatMoney(summary.totalDeductions, { prefix: '-฿' })}
  • กองทุนสำรองเลี้ยงชีพ (${((settings.providentFundRate || 0) * 100).toFixed(0)}%): ${formatMoney(summary.providentFundAmount, { prefix: '-฿' })}
  • ประกันสังคม (ปกส.): ${formatMoney(summary.socialSecurityAmount, { prefix: '-฿' })}
${summary.diligenceDeduction > 0 ? `  • หักเบี้ยขยัน (ลาไม่รวมพักร้อน ${summary.qualifyingLeaveDaysCount} วัน): ${formatMoney(summary.diligenceDeduction, { prefix: '-฿' })}\n` : ''}${summary.shiftAllowanceDeduction > 0 ? `  • หักค่าเข้ากะ (ลาไม่รวมพักร้อน ${summary.qualifyingLeaveDaysCount} วัน): ${formatMoney(summary.shiftAllowanceDeduction, { prefix: '-฿' })}\n` : ''}${summary.taxPaid > 0 ? `  • ภาษีที่จ่ายไป: ${formatMoney(summary.taxPaid, { prefix: '-฿' })}\n` : ''}${settings.otherDeductions > 0 ? `  • หักอื่นๆ: ${formatMoney(settings.otherDeductions, { prefix: '-฿' })}\n` : ''}---------------------------------
💵 ยอดรับสุทธิ (Net Pay): ${formatMoney(summary.netIncome)}
(คำนวณอัตโนมัติด้วยระบบ OT PayMaster)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Modal Top Control Bar (Non-printed) */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 print:hidden">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
              <span className="font-bold text-xs sm:text-sm truncate">ใบแจ้งยอดเงินได้ (Pay Slip Preview)</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors sm:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกสรุป'}</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              title="ดาวน์โหลดรายงานสลิปเงินเดือนเป็นไฟล์ PDF"
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-bold text-white shadow transition-colors"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingPdf ? 'กำลังสร้าง PDF...' : 'Download PDF'}</span>
            </button>

            {onOpenPaySlipVault && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPaySlipVault();
                }}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow transition-colors"
              >
                <FileImage className="w-3.5 h-3.5" />
                <span>คลังภาพสลิป</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์เอกสาร</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 hidden sm:block"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 font-medium print:hidden">
            {pdfError}
          </div>
        )}

        {/* Slip Document Area (Formal Design) */}
        <div id="printable-payslip" className="p-4 sm:p-8 overflow-y-auto bg-white text-slate-800">
          
          {/* Slip Header */}
          <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-slate-800" />
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  ใบแจ้งยอดเงินได้และค่าทำงานล่วงเวลา
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                PAYROLL SLIP & OVERTIME STATEMENT
              </p>
            </div>
            <div className="text-right sm:text-right">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg block sm:inline-block">
                รอบคำนวณ: {cycleLabel}
              </span>
            </div>
          </div>

          {/* Employee & Base Rate Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block">ชื่อพนักงาน:</span>
              <strong className="text-slate-800 text-sm">{settings.employeeName || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">รหัสพนักงาน:</span>
              <strong className="text-slate-800 text-sm">{settings.employeeId || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">ฝ่าย / แผนก:</span>
              <strong className="text-slate-800">{settings.department || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">ค่าแรง/ชม. (ฐาน/30/8):</span>
              <strong className="text-indigo-700 font-mono tabular-nums">{formatMoney(summary.hourlyRate)}</strong>
            </div>
          </div>

          {/* Dual Columns: Earnings vs Deductions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-5">
            
            {/* Left Column: รายการเงินได้ (Earnings) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-emerald-50 text-emerald-900 font-bold px-3 py-2 text-xs border-b border-emerald-100 uppercase tracking-wide flex justify-between">
                <span>รายการเงินได้ (Earnings)</span>
                <span>จำนวนเงิน (บาท)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs p-1">
                <div className="flex justify-between py-1.5 px-2">
                  <span>เงินเดือนประจำ (Base Salary)</span>
                  <span className="font-semibold font-mono tabular-nums">{formatMoney(settings.baseSalary)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-emerald-800 font-medium">
                  <span>ค่าล่วงเวลา OT 1.5x ({summary.totalOt1_5_hours} ชม.)</span>
                  <span className="font-mono tabular-nums">{formatMoney(summary.ot1_5_amount)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-blue-800 font-medium">
                  <span>ค่าล่วงเวลา OT 1.0x ({summary.totalOt1_0_hours} ชม.)</span>
                  <span className="font-mono tabular-nums">{formatMoney(summary.ot1_0_amount)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-purple-800 font-medium">
                  <span>ค่าล่วงเวลา OT 3.0x ({summary.totalOt3_0_hours} ชม.)</span>
                  <span className="font-mono tabular-nums">{formatMoney(summary.ot3_0_amount)}</span>
                </div>
                {settings.housingAllowance > 0 && (
                  <div className="flex justify-between py-1.5 px-2">
                    <span>ค่าบ้าน (Housing Allowance)</span>
                    <span className="font-mono tabular-nums">{formatMoney(settings.housingAllowance)}</span>
                  </div>
                )}
                {settings.hardshipAllowance > 0 && (
                  <div className="flex justify-between py-1.5 px-2">
                    <span>ค่ากันดาร (Hardship Allowance)</span>
                    <span className="font-mono tabular-nums">{formatMoney(settings.hardshipAllowance)}</span>
                  </div>
                )}
                {settings.shiftWorkEnabled && summary.shiftAmount > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-indigo-700 dark:text-indigo-400">
                    <span>ค่าเข้ากะ (Shift Allowance)</span>
                    <span className="font-mono tabular-nums">{formatMoney(summary.shiftAmount)}</span>
                  </div>
                )}
                {summary.diligenceAmount > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-amber-700">
                    <span>เบี้ยขยัน (Diligence)</span>
                    <span className="font-mono tabular-nums">{formatMoney(summary.diligenceAmount)}</span>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 border-t border-slate-200 flex justify-between">
                <span>รวมเงินได้ก่อนหัก</span>
                <span className="text-emerald-700 text-sm font-mono tabular-nums">{formatMoney(summary.totalGrossIncome)}</span>
              </div>
            </div>

            {/* Right Column: รายการหัก (Deductions) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-rose-50 text-rose-900 font-bold px-3 py-2 text-xs border-b border-rose-100 uppercase tracking-wide flex justify-between">
                <span>รายการหัก (Deductions)</span>
                <span>จำนวนเงิน (บาท)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs p-1">
                <div className="flex justify-between py-1.5 px-2 text-rose-700">
                  <span>กองทุนสำรองเลี้ยงชีพ ({((settings.providentFundRate || 0) * 100).toFixed(0)}%)</span>
                  <span className="font-mono tabular-nums">{formatMoney(summary.providentFundAmount, { prefix: '-฿' })}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-rose-700">
                  <span>เงินสมทบประกันสังคม (ปกส.)</span>
                  <span className="font-mono tabular-nums">{formatMoney(summary.socialSecurityAmount, { prefix: '-฿' })}</span>
                </div>
                {/* 4. หักเบี้ยขยัน: คิดจากวันลาที่ไม่รวมลาพักร้อน (1 วัน หัก 1/2, 2 วัน+ หัก 100%) */}
                {summary.diligenceDeduction > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700 font-medium bg-rose-50/50">
                    <div>
                      <span>หักเบี้ยขยัน</span>
                      <span className="text-[10px] text-slate-500 block">
                        (ลาไม่รวมพักร้อน {summary.qualifyingLeaveDaysCount} วัน: หัก {summary.qualifyingLeaveDaysCount === 1 ? '1/2' : '100%'})
                      </span>
                    </div>
                    <span className="font-mono tabular-nums">{formatMoney(summary.diligenceDeduction, { prefix: '-฿' })}</span>
                  </div>
                )}
                {/* 5. หักค่าเข้ากะ: คิดจากวันลาที่ไม่รวมลาพักร้อน (1 วัน หัก 1/3, 2 วัน หัก 2/3, 3 วัน+ หัก 100%) */}
                {settings.shiftWorkEnabled && summary.shiftAllowanceDeduction > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700 font-medium bg-rose-50/50">
                    <div>
                      <span>หักค่าเข้ากะ</span>
                      <span className="text-[10px] text-slate-500 block">
                        (ลาไม่รวมพักร้อน {summary.qualifyingLeaveDaysCount} วัน: หัก {summary.qualifyingLeaveDaysCount === 1 ? '1/3' : summary.qualifyingLeaveDaysCount === 2 ? '2/3' : '100%'})
                      </span>
                    </div>
                    <span className="font-mono tabular-nums">{formatMoney(summary.shiftAllowanceDeduction, { prefix: '-฿' })}</span>
                  </div>
                )}
                {summary.taxPaid > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700">
                    <span>ภาษีหัก ณ ที่จ่าย (ภาษีที่จ่ายไป)</span>
                    <span className="font-mono tabular-nums">{formatMoney(summary.taxPaid, { prefix: '-฿' })}</span>
                  </div>
                )}
                {settings.otherDeductions > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700">
                    <span>หักอื่นๆ</span>
                    <span className="font-mono tabular-nums">{formatMoney(settings.otherDeductions, { prefix: '-฿' })}</span>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 border-t border-slate-200 flex justify-between">
                <span>รวมรายการหัก</span>
                <span className="text-rose-600 text-sm font-mono tabular-nums">{formatMoney(summary.totalDeductions, { prefix: '-฿' })}</span>
              </div>
            </div>

          </div>

          {/* Bottom Net Pay Highlight */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider block">
                เงินได้สุทธิที่ได้รับจริง (NET TAKE-HOME PAY)
              </span>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums font-mono">
                เงินได้ก่อนหักภาษี {formatMoney(summary.incomeBeforeTax)} {summary.taxPaid > 0 ? `(หักภาษี ${formatMoney(summary.taxPaid)})` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight font-mono tabular-nums">
                {formatMoney(summary.netIncome)}
              </span>
            </div>
          </div>

          {/* Attached Slip Image Preview & Optional Inline Upload */}
          <div className="mt-5 pt-4 border-t border-slate-200 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                void handleInlineImageSelect(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div className="flex items-center justify-between gap-2 print:hidden">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-cyan-600" />
                <span>
                  {effectiveSlip
                    ? `ภาพสลิปที่แนบใน PDF: ${effectiveSlip.fileName}`
                    : 'แนบภาพสลิปเงินเดือนเพื่อรวมในไฟล์ PDF (ถ้ามี)'}
                </span>
              </span>
              <div className="flex items-center gap-2">
                {inlineImageDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInlineImageDataUrl('');
                      setInlineImageName('');
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    ล้างภาพชั่วคราว
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>{effectiveSlip ? 'เปลี่ยนภาพสลิป' : 'แนบภาพสลิป'}</span>
                </button>
              </div>
            </div>

            {effectiveSlip?.imageDataUrl && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex flex-col items-center">
                <img
                  src={effectiveSlip.imageDataUrl}
                  alt={effectiveSlip.fileName}
                  className="max-h-56 w-auto object-contain rounded-lg bg-white shadow-xs"
                />
              </div>
            )}
          </div>

          {/* Signature Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 text-center text-xs text-slate-500">
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 w-36 mx-auto mb-1"></div>
              <span>ลงชื่อพนักงานผู้รับเงิน</span>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 w-36 mx-auto mb-1"></div>
              <span>ลงชื่อผู้อนุมัติ / เจ้าหน้าที่การเงิน</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
