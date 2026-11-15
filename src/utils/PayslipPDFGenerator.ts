import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  PaySlipAttachment,
  PayrollSettings,
  PayrollSummary,
} from '../types/overtime';

const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export function formatCycleKeyToMonthYear(cycleKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec((cycleKey || '').trim());
  if (!match) return (cycleKey || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${match[2]}-${match[1]}`;
}

export function formatCycleMonthYearThai(cycleKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec((cycleKey || '').trim());
  if (!match) return cycleKey || '-';
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const monthName = THAI_MONTHS_FULL[monthIdx] || match[2];
  return `${monthName} ${year}`;
}

export function formatPayPeriodThaiLabel(cycleKey: string): string {
  const label = formatCycleMonthYearThai(cycleKey);
  return label === '-' ? '-' : `รอบเดือน ${label}`;
}

export function formatCycleKeyThaiLabel(cycleKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec((cycleKey || '').trim());
  if (!match) return cycleKey || '-';
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const monthName = THAI_MONTHS_FULL[monthIdx] || match[2];
  return `${monthName} ${year} (${match[2]}/${year})`;
}

export function sanitizeFileNameSegment(raw: string, fallback = 'Employee'): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

export function formatSimplePayslipPdfFileName(cycleKey: string): string {
  const monthYear = formatCycleKeyToMonthYear(cycleKey);
  return `Payslip_${monthYear}.pdf`;
}

export function formatPayslipPdfFileName(employeeName: string, cycleKey: string): string {
  const safeName = sanitizeFileNameSegment(employeeName, 'Employee');
  const monthYear = formatCycleKeyToMonthYear(cycleKey);
  return `Payslip_Report_${safeName}_${monthYear}.pdf`;
}

function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatThb(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatThaiDateTime(iso: string): string {
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

export interface PayslipPDFGeneratorInput {
  settings: PayrollSettings;
  cycleKey: string;
  cycleLabel?: string;
  summary?: PayrollSummary;
  slip?: PaySlipAttachment | null;
}

function buildRow(label: string, value: string, color = '#334155', bold = false): string {
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:2px 0;color:${color};font-weight:${bold ? '700' : '400'};">
    <span>${label}</span>
    <span style="font-variant-numeric:tabular-nums;white-space:nowrap;">${value}</span>
  </div>`;
}

function buildStructuredBreakdownHtml(
  settings: PayrollSettings,
  summary?: PayrollSummary
): { html: string; hasDetailedRows: boolean } {
  if (!summary) {
    return { hasDetailedRows: false, html: '' };
  }

  const earningsRows: string[] = [
    buildRow('เงินเดือนประจำ (Base Salary)', `฿${formatThb(settings.baseSalary)}`),
  ];
  if (summary.totalOt1_5_hours > 0 || summary.ot1_5_amount > 0) {
    earningsRows.push(
      buildRow(
        `ค่าล่วงเวลา OT 1.5x (${summary.totalOt1_5_hours} ชม.)`,
        `฿${formatThb(summary.ot1_5_amount)}`,
        '#065f46'
      )
    );
  }
  if (summary.totalOt1_0_hours > 0 || summary.ot1_0_amount > 0) {
    earningsRows.push(
      buildRow(
        `ค่าล่วงเวลา OT 1.0x (${summary.totalOt1_0_hours} ชม.)`,
        `฿${formatThb(summary.ot1_0_amount)}`,
        '#1e40af'
      )
    );
  }
  if (summary.totalOt3_0_hours > 0 || summary.ot3_0_amount > 0) {
    earningsRows.push(
      buildRow(
        `ค่าล่วงเวลา OT 3.0x (${summary.totalOt3_0_hours} ชม.)`,
        `฿${formatThb(summary.ot3_0_amount)}`,
        '#6b21a8'
      )
    );
  }
  if (settings.housingAllowance > 0) {
    earningsRows.push(buildRow('ค่าบ้าน (Housing Allowance)', `฿${formatThb(settings.housingAllowance)}`));
  }
  if (settings.hardshipAllowance > 0) {
    earningsRows.push(buildRow('ค่ากันดาร (Hardship Allowance)', `฿${formatThb(settings.hardshipAllowance)}`));
  }
  if (settings.shiftWorkEnabled && summary.shiftAmount > 0) {
    earningsRows.push(buildRow('ค่าเข้ากะ (Shift Allowance)', `฿${formatThb(summary.shiftAmount)}`, '#3730a3'));
  }
  if (summary.diligenceAmount > 0) {
    earningsRows.push(buildRow('เบี้ยขยัน (Diligence)', `฿${formatThb(summary.diligenceAmount)}`, '#92400e'));
  }

  const dedRows: string[] = [
    buildRow(
      `กองทุนสำรองเลี้ยงชีพ (${((settings.providentFundRate || 0) * 100).toFixed(0)}%)`,
      `-฿${formatThb(summary.providentFundAmount)}`,
      '#be123c'
    ),
    buildRow('ประกันสังคม (ปกส.)', `-฿${formatThb(summary.socialSecurityAmount)}`, '#be123c'),
  ];
  if (summary.diligenceDeduction > 0) {
    dedRows.push(
      buildRow(
        `หักเบี้ยขยัน (ลา ${summary.qualifyingLeaveDaysCount} วัน)`,
        `-฿${formatThb(summary.diligenceDeduction)}`,
        '#be123c'
      )
    );
  }
  if (settings.shiftWorkEnabled && summary.shiftAllowanceDeduction > 0) {
    dedRows.push(
      buildRow(
        `หักค่าเข้ากะ (ลา ${summary.qualifyingLeaveDaysCount} วัน)`,
        `-฿${formatThb(summary.shiftAllowanceDeduction)}`,
        '#be123c'
      )
    );
  }
  if (summary.taxPaid > 0) {
    dedRows.push(buildRow('ภาษีหัก ณ ที่จ่าย', `-฿${formatThb(summary.taxPaid)}`, '#be123c'));
  }
  if (settings.otherDeductions > 0) {
    dedRows.push(buildRow('หักอื่นๆ', `-฿${formatThb(settings.otherDeductions)}`, '#be123c'));
  }

  return {
    hasDetailedRows: true,
    html: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div style="border:1px solid #d1fae5;border-radius:10px;overflow:hidden;background:#ffffff;">
          <div style="background:#ecfdf5;padding:6px 10px;font-size:11px;font-weight:700;color:#065f46;display:flex;justify-content:space-between;border-bottom:1px solid #d1fae5;">
            <span>รายการรายรับ (Earnings)</span>
            <span>฿${formatThb(summary.totalGrossIncome)}</span>
          </div>
          <div style="padding:7px 10px;font-size:10.5px;line-height:1.5;">
            ${earningsRows.join('')}
          </div>
        </div>
        <div style="border:1px solid #ffe4e6;border-radius:10px;overflow:hidden;background:#ffffff;">
          <div style="background:#fff1f2;padding:6px 10px;font-size:11px;font-weight:700;color:#9f1239;display:flex;justify-content:space-between;border-bottom:1px solid #ffe4e6;">
            <span>รายการรายหัก (Deductions)</span>
            <span>-฿${formatThb(summary.totalDeductions)}</span>
          </div>
          <div style="padding:7px 10px;font-size:10.5px;line-height:1.5;">
            ${dedRows.join('')}
          </div>
        </div>
      </div>
    `,
  };
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('ไม่สามารถโหลดภาพสลิปเพื่อสร้างเอกสาร PDF ได้'));
    img.src = src;
  });
  if (typeof img.decode === 'function') {
    try {
      await img.decode();
    } catch {
      // Already decoded via onload
    }
  }
  return img;
}

/**
 * Builds an A4 portrait PDF Blob containing ONLY the uploaded slip image,
 * scaled proportionally to fit the full page crisply with zero extra text or tables.
 */
async function buildImageOnlyA4PdfBlob(
  imageDataUrl: string,
  fileName: string
): Promise<{ blob: Blob; fileName: string }> {
  const img = await loadImageElement(imageDataUrl);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  if (!naturalW || !naturalH) {
    throw new Error('ขนาดรูปภาพสลิปไม่ถูกต้อง ไม่สามารถสร้างไฟล์ PDF ได้');
  }

  const canvas = document.createElement('canvas');
  canvas.width = naturalW;
  canvas.height = naturalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ไม่สามารถประมวลผลภาพสลิปเพื่อสร้าง PDF ได้');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, naturalW, naturalH);
  ctx.drawImage(img, 0, 0, naturalW, naturalH);

  const normalizedJpeg = canvas.toDataURL('image/jpeg', 0.96);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
  const marginMm = 4;
  const availW = pageWidth - marginMm * 2;
  const availH = pageHeight - marginMm * 2;

  const imgRatio = naturalW / naturalH;
  const boxRatio = availW / availH;

  let renderW = availW;
  let renderH = availH;
  if (imgRatio > boxRatio) {
    renderW = availW;
    renderH = availW / imgRatio;
  } else {
    renderH = availH;
    renderW = availH * imgRatio;
  }

  const offsetX = (pageWidth - renderW) / 2;
  const offsetY = (pageHeight - renderH) / 2;

  pdf.addImage(normalizedJpeg, 'JPEG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');
  const blob = pdf.output('blob');

  return {
    blob,
    fileName,
  };
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 1500);
}

async function generateImageOnlyA4Pdf(
  imageDataUrl: string,
  fileName: string
): Promise<{ fileName: string }> {
  const prepared = await buildImageOnlyA4PdfBlob(imageDataUrl, fileName);
  triggerBlobDownload(prepared.blob, prepared.fileName);
  return { fileName: prepared.fileName };
}

/**
 * PayslipPDFGenerator
 * - `generateSimpleImagePdf(slip)`: Renders ONLY the slip image cleanly full-page on A4
 *   with filename `Payslip_[Month-Year].pdf`.
 * - `generateFromPayrollSummary`: Renders image-only A4 if an image slip is attached,
 *   or renders the calculated OT/payroll statement when no slip image is attached.
 */
export const PayslipPDFGenerator = {
  formatSimpleFilename(cycleKey: string): string {
    return formatSimplePayslipPdfFileName(cycleKey);
  },

  formatFilename(employeeName: string, cycleKey: string): string {
    return formatPayslipPdfFileName(employeeName, cycleKey);
  },

  async generateSimpleImagePdf(slip: Pick<PaySlipAttachment, 'cycleKey' | 'imageDataUrl'>): Promise<{ fileName: string }> {
    if (!slip?.imageDataUrl) {
      throw new Error('ไม่พบรูปภาพสลิปสำหรับสร้างไฟล์ PDF');
    }
    const fileName = formatSimplePayslipPdfFileName(slip.cycleKey);
    return generateImageOnlyA4Pdf(slip.imageDataUrl, fileName);
  },

  async generateFromSlip(
    slip: PaySlipAttachment
  ): Promise<{ fileName: string }> {
    return PayslipPDFGenerator.generateSimpleImagePdf(slip);
  },

  async generateFromPayrollSummary(params: {
    summary: PayrollSummary;
    settings: PayrollSettings;
    cycleKey: string;
    cycleLabel?: string;
    attachedSlip?: PaySlipAttachment | null;
  }): Promise<{ fileName: string }> {
    return PayslipPDFGenerator.generate({
      settings: params.settings,
      cycleKey: params.cycleKey,
      cycleLabel: params.cycleLabel,
      summary: params.summary,
      slip: params.attachedSlip || null,
    });
  },

  async generate(input: PayslipPDFGeneratorInput): Promise<{ fileName: string }> {
    const { settings, cycleKey, summary, slip } = input;
    const fileName = formatPayslipPdfFileName(settings.employeeName, cycleKey);

    if (slip?.imageDataUrl) {
      return generateImageOnlyA4Pdf(slip.imageDataUrl, formatSimplePayslipPdfFileName(cycleKey));
    }

    const employeeName = escapeHtml(settings.employeeName || '-');
    const employeeId = escapeHtml(settings.employeeId || '-');
    const department = escapeHtml(settings.department || '-');
    const appName = escapeHtml(settings.appName || 'OT PayMaster');
    const resolvedCycleLabel = escapeHtml(
      input.cycleLabel || formatCycleKeyThaiLabel(cycleKey)
    );
    const bankName = escapeHtml('คำนวณตามระบบ OT PayMaster');
    const noteText = escapeHtml(
      summary
        ? `ค่าแรง/ชม. ฿${formatThb(summary.hourlyRate)} • OT รวม ${summary.totalOtHours} ชม.`
        : '-'
    );

    const effectiveNetPay = summary?.netIncome || 0;
    const netAmountFormatted = formatThb(effectiveNetPay);
    const uploadedAtFormatted = escapeHtml(formatThaiDateTime(new Date().toISOString()));
    const exportedAtFormatted = escapeHtml(formatThaiDateTime(new Date().toISOString()));

    const { html: breakdownHtml } = buildStructuredBreakdownHtml(settings, summary);

    const attachedImageSection = `
      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:18px;background:#f8fafc;margin-top:8px;">
        <div style="background:#0f172a;color:#ffffff;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.06em;color:#cbd5e1;text-transform:uppercase;">
              NET TAKE-HOME PAY • ยอดรับสุทธิประจำงวด
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
              ${
                summary
                  ? `เงินได้ก่อนหักภาษี ฿${formatThb(summary.incomeBeforeTax)}${
                      summary.taxPaid > 0 ? ` (หักภาษี ฿${formatThb(summary.taxPaid)})` : ''
                    }`
                  : `รอบเดือน ${resolvedCycleLabel}`
              }
            </div>
          </div>
          <div style="font-size:24px;font-weight:800;color:#fcd34d;font-variant-numeric:tabular-nums;">
            ฿${netAmountFormatted}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;text-align:center;font-size:11px;color:#475569;padding-top:16px;">
          <div>
            <div style="height:44px;border-bottom:1px dashed #94a3b8;width:180px;margin:0 auto 8px auto;"></div>
            <div>ลงชื่อพนักงานผู้รับเงิน</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">(${employeeName})</div>
          </div>
          <div>
            <div style="height:44px;border-bottom:1px dashed #94a3b8;width:180px;margin:0 auto 8px auto;"></div>
            <div>ลงชื่อผู้อนุมัติ / เจ้าหน้าที่การเงิน</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${appName}</div>
          </div>
        </div>
      </div>
    `;

    const reportHtml = `
      <div id="payslip-pdf-root" style="width:794px;min-height:1122px;background-color:#ffffff;color:#0f172a;font-family:'Prompt','Plus Jakarta Sans',sans-serif;padding:32px 38px;box-sizing:border-box;">
        <div style="display:flex;flex-direction:column;height:1056px;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:16px;">
              <div>
                <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#4f46e5;text-transform:uppercase;">
                  ${appName} • PAYSLIP REPORT
                </div>
                <h1 style="margin:4px 0 0 0;font-size:21px;font-weight:800;color:#0f172a;line-height:1.25;">
                  ใบแจ้งยอดเงินได้และรายงานสลิปเงินเดือน
                </h1>
                <div style="margin-top:3px;font-size:11.5px;color:#64748b;">
                  PAYROLL SLIP &amp; OVERTIME STATEMENT
                </div>
              </div>
              <div style="text-align:right;">
                <div style="display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:8px;">
                  รอบเดือน: ${resolvedCycleLabel}
                </div>
                <div style="margin-top:5px;font-size:10px;color:#64748b;">
                  รหัสอ้างอิงงวด: ${escapeHtml(cycleKey)}
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
              <div>
                <div style="font-size:10px;color:#64748b;font-weight:600;">ชื่อพนักงาน</div>
                <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">${employeeName}</div>
              </div>
              <div>
                <div style="font-size:10px;color:#64748b;font-weight:600;">รหัสพนักงาน</div>
                <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">${employeeId}</div>
              </div>
              <div>
                <div style="font-size:10px;color:#64748b;font-weight:600;">แผนก / ฝ่าย</div>
                <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">${department}</div>
              </div>
              <div>
                <div style="font-size:10px;color:#64748b;font-weight:600;">${
                  summary ? 'ค่าแรง/ชม. (ฐาน/30/8)' : 'ธนาคารที่รับเงิน'
                }</div>
                <div style="font-size:13px;font-weight:700;color:#4f46e5;margin-top:2px;">${
                  summary ? `฿${formatThb(summary.hourlyRate)}` : bankName
                }</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1.2fr 1.2fr 1.6fr;gap:12px;margin-bottom:14px;">
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#ffffff;">
                <div style="font-size:10px;color:#64748b;font-weight:600;">ธนาคาร / ช่องทางรับเงิน</div>
                <div style="font-size:13.5px;font-weight:700;color:#0f172a;margin-top:2px;">${bankName}</div>
                <div style="font-size:9.5px;color:#94a3b8;margin-top:3px;">ข้อมูล ณ ${uploadedAtFormatted}</div>
              </div>

              <div style="border:1px solid #a7f3d0;border-radius:12px;padding:10px 12px;background:#ecfdf5;">
                <div style="font-size:10px;color:#047857;font-weight:700;">ยอดเงินได้สุทธิ (Net Pay)</div>
                <div style="font-size:19px;font-weight:800;color:#065f46;margin-top:2px;font-variant-numeric:tabular-nums;">
                  ฿${netAmountFormatted}
                </div>
                <div style="font-size:9.5px;color:#059669;margin-top:2px;">บาท (THB)</div>
              </div>

              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#ffffff;">
                <div style="font-size:10px;color:#64748b;font-weight:600;">หมายเหตุ / รายละเอียดเพิ่มเติม</div>
                <div style="font-size:11px;color:#334155;margin-top:3px;line-height:1.4;word-break:break-word;">
                  ${noteText}
                </div>
              </div>
            </div>

            ${breakdownHtml}
            ${attachedImageSection}
          </div>

          <div style="border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b;">
            <span>สร้างรายงานอัตโนมัติโดย ${appName}</span>
            <span>วันที่ออกเอกสาร PDF: ${exportedAtFormatted}</span>
          </div>
        </div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '794px';
    iframe.style.height = '1122px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('ไม่สามารถสร้างพื้นที่จำลองเอกสาร PDF ได้');
      }

      iframeDoc.open();
      iframeDoc.write(`<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        color: #0f172a;
        font-family: 'Prompt', 'Plus Jakarta Sans', sans-serif;
      }
    </style>
  </head>
  <body>${reportHtml}</body>
</html>`);
      iframeDoc.close();

      if (iframeDoc.readyState !== 'complete') {
        await Promise.race([
          new Promise<void>((resolve) => {
            iframe.addEventListener('load', () => resolve(), { once: true });
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
      }

      if (iframeDoc.fonts && iframeDoc.fonts.ready) {
        await Promise.race([
          iframeDoc.fonts.ready,
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
      }

      const reportRoot = iframeDoc.getElementById('payslip-pdf-root') || iframeDoc.body;
      const canvas = await html2canvas(reportRoot, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        height: 1122,
        windowWidth: 794,
        windowHeight: 1122,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const renderW = canvas.width * ratio;
      const renderH = canvas.height * ratio;
      const offsetX = (pageWidth - renderW) / 2;
      const offsetY = (pageHeight - renderH) / 2;

      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');
      pdf.save(fileName);

      return { fileName };
    } finally {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }
  },
};
