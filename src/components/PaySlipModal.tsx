import React, { useState } from 'react';
import { PayrollSettings, PayrollSummary } from '../types/overtime';
import { formatCurrency, formatNumber } from '../utils/calculator';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  Building2, 
  FileText, 
  Share2,
  Calendar
} from 'lucide-react';

interface PaySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PayrollSummary;
  settings: PayrollSettings;
  cycleLabel: string;
}

export const PaySlipModal: React.FC<PaySlipModalProps> = ({
  isOpen,
  onClose,
  summary,
  settings,
  cycleLabel,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = `📋 ใบแจ้งยอดเงินได้ & สรุป OT ประจำงวด
พนักงาน: ${settings.employeeName} (${settings.department || 'ฝ่ายปฏิบัติการ'})
รอบตัดวิก: ${cycleLabel}
---------------------------------
💰 รวมเงินได้ก่อนหัก: ฿${formatCurrency(summary.totalGrossIncome)}
  • ฐานเงินเดือน: ฿${formatCurrency(settings.baseSalary)}
  • ค่าล่วงเวลา OT (${summary.totalOtHours} ชม.): ฿${formatCurrency(summary.totalOtAmount)}
    - OT 1.5x (${summary.totalOt1_5_hours} ชม.): ฿${formatCurrency(summary.ot1_5_amount)}
    - OT 1.0x (${summary.totalOt1_0_hours} ชม.): ฿${formatCurrency(summary.ot1_0_amount)}
    - OT 3.0x (${summary.totalOt3_0_hours} ชม.): ฿${formatCurrency(summary.ot3_0_amount)}
  • ค่าสวัสดิการ & ค่ากะ: ฿${formatCurrency(summary.totalFixedAllowances + summary.diligenceAmount + summary.shiftAmount)}
---------------------------------
🔻 รายการหัก: -฿${formatCurrency(summary.totalDeductions)}
  • กองทุนสำรองเลี้ยงชีพ (${((settings.providentFundRate || 0) * 100).toFixed(0)}%): -฿${formatCurrency(summary.providentFundAmount)}
  • ประกันสังคม (ปกส.): -฿${formatCurrency(summary.socialSecurityAmount)}
${summary.diligenceDeduction > 0 ? `  • หักเบี้ยขยัน (ลา ${summary.leaveDaysCount} วัน): -฿${formatCurrency(summary.diligenceDeduction)}\n` : ''}${summary.shiftAllowanceDeduction > 0 ? `  • หักค่าเข้ากะ (ลา ${summary.leaveDaysCount} วัน): -฿${formatCurrency(summary.shiftAllowanceDeduction)}\n` : ''}${summary.taxPaid > 0 ? `  • ภาษีที่จ่ายไป: -฿${formatCurrency(summary.taxPaid)}\n` : ''}${settings.otherDeductions > 0 ? `  • หักอื่นๆ: -฿${formatCurrency(settings.otherDeductions)}\n` : ''}---------------------------------
💵 ยอดรับสุทธิ (Net Pay): ฿${formatCurrency(summary.netIncome)}
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

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopySummary}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกสรุป'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์เอกสาร</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 hidden sm:block"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
              <strong className="text-indigo-700">฿{formatCurrency(summary.hourlyRate)}</strong>
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
                  <span className="font-semibold">฿{formatCurrency(settings.baseSalary)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-emerald-800 font-medium">
                  <span>ค่าล่วงเวลา OT 1.5x ({summary.totalOt1_5_hours} ชม.)</span>
                  <span>฿{formatCurrency(summary.ot1_5_amount)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-blue-800 font-medium">
                  <span>ค่าล่วงเวลา OT 1.0x ({summary.totalOt1_0_hours} ชม.)</span>
                  <span>฿{formatCurrency(summary.ot1_0_amount)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-purple-800 font-medium">
                  <span>ค่าล่วงเวลา OT 3.0x ({summary.totalOt3_0_hours} ชม.)</span>
                  <span>฿{formatCurrency(summary.ot3_0_amount)}</span>
                </div>
                {settings.housingAllowance > 0 && (
                  <div className="flex justify-between py-1.5 px-2">
                    <span>ค่าบ้าน (Housing Allowance)</span>
                    <span>฿{formatCurrency(settings.housingAllowance)}</span>
                  </div>
                )}
                {settings.hardshipAllowance > 0 && (
                  <div className="flex justify-between py-1.5 px-2">
                    <span>ค่ากันดาร (Hardship Allowance)</span>
                    <span>฿{formatCurrency(settings.hardshipAllowance)}</span>
                  </div>
                )}
                {settings.shiftWorkEnabled && summary.shiftAmount > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-indigo-700 dark:text-indigo-400">
                    <span>ค่าเข้ากะ (Shift Allowance)</span>
                    <span>฿{formatCurrency(summary.shiftAmount)}</span>
                  </div>
                )}
                {summary.diligenceAmount > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-amber-700">
                    <span>เบี้ยขยัน (Diligence)</span>
                    <span>฿{formatCurrency(summary.diligenceAmount)}</span>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 border-t border-slate-200 flex justify-between">
                <span>รวมเงินได้ก่อนหัก</span>
                <span className="text-emerald-700 text-sm">฿{formatCurrency(summary.totalGrossIncome)}</span>
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
                  <span>-฿{formatCurrency(summary.providentFundAmount)}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2 text-rose-700">
                  <span>เงินสมทบประกันสังคม (ปกส.)</span>
                  <span>-฿{formatCurrency(summary.socialSecurityAmount)}</span>
                </div>
                {/* 4. หักเบี้ยขยัน: คิดจากวันลา โดยลา 1 วัน หัก 500 */}
                {summary.diligenceDeduction > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700 font-medium bg-rose-50/50">
                    <div>
                      <span>หักเบี้ยขยัน</span>
                      <span className="text-[10px] text-slate-500 block">
                        (ขาด/ลา {summary.leaveDaysCount} วัน x ฿500)
                      </span>
                    </div>
                    <span>-฿{formatCurrency(summary.diligenceDeduction)}</span>
                  </div>
                )}
                {/* 5. หักค่าเข้ากะ: คิดจากวันลา โดยลา 1 วัน หัก 900 */}
                {settings.shiftWorkEnabled && summary.shiftAllowanceDeduction > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700 font-medium bg-rose-50/50">
                    <div>
                      <span>หักค่าเข้ากะ</span>
                      <span className="text-[10px] text-slate-500 block">
                        (ขาด/ลา {summary.leaveDaysCount} วัน x ฿900)
                      </span>
                    </div>
                    <span>-฿{formatCurrency(summary.shiftAllowanceDeduction)}</span>
                  </div>
                )}
                {summary.taxPaid > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700">
                    <span>ภาษีหัก ณ ที่จ่าย (ภาษีที่จ่ายไป)</span>
                    <span>-฿{formatCurrency(summary.taxPaid)}</span>
                  </div>
                )}
                {settings.otherDeductions > 0 && (
                  <div className="flex justify-between py-1.5 px-2 text-rose-700">
                    <span>หักอื่นๆ</span>
                    <span>-฿{formatCurrency(settings.otherDeductions)}</span>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 border-t border-slate-200 flex justify-between">
                <span>รวมรายการหัก</span>
                <span className="text-rose-600 text-sm">-฿{formatCurrency(summary.totalDeductions)}</span>
              </div>
            </div>

          </div>

          {/* Bottom Net Pay Highlight */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider block">
                เงินได้สุทธิที่ได้รับจริง (NET TAKE-HOME PAY)
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                เงินได้ก่อนหักภาษี ฿{formatCurrency(summary.incomeBeforeTax)} {summary.taxPaid > 0 ? `(หักภาษี ฿${formatCurrency(summary.taxPaid)})` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
                ฿{formatCurrency(summary.netIncome)}
              </span>
            </div>
          </div>

          {/* Signature Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 text-center text-xs text-slate-500">
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
