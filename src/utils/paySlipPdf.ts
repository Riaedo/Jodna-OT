import { PaySlipAttachment } from '../types/overtime';
import {
  PayslipPDFGenerator,
  formatCycleKeyThaiLabel,
  formatCycleKeyToMonthYear,
  formatCycleMonthYearThai,
  formatPayPeriodThaiLabel,
  formatPayslipPdfFileName,
  formatSimplePayslipPdfFileName,
  sanitizeFileNameSegment,
} from './PayslipPDFGenerator';

export {
  PayslipPDFGenerator,
  formatCycleKeyThaiLabel,
  formatCycleKeyToMonthYear,
  formatCycleMonthYearThai,
  formatPayPeriodThaiLabel,
  formatPayslipPdfFileName,
  formatSimplePayslipPdfFileName,
  sanitizeFileNameSegment,
};

export async function generatePaySlipPdf(
  slip: PaySlipAttachment
): Promise<{ fileName: string }> {
  return PayslipPDFGenerator.generateSimpleImagePdf(slip);
}
