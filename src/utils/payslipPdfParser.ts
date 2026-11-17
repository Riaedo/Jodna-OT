import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { estimateDataUrlByteSize } from './imageCompression';

// Configure local bundled pdf.js worker (no external CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ProcessedPaySlipPdfResult {
  dataUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  detectedCycleKey?: string;
}

const MAX_RAW_PDF_BYTES = 25 * 1024 * 1024;
const TARGET_MAX_IMAGE_BYTES = 420 * 1024;

const ENG_MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const THAI_MONTH_MAP: Array<{ pattern: string; month: number }> = [
  { pattern: 'มกราคม', month: 1 },
  { pattern: 'ม.ค.', month: 1 },
  { pattern: 'มค', month: 1 },
  { pattern: 'กุมภาพันธ์', month: 2 },
  { pattern: 'ก.พ.', month: 2 },
  { pattern: 'กพ', month: 2 },
  { pattern: 'มีนาคม', month: 3 },
  { pattern: 'มี.ค.', month: 3 },
  { pattern: 'มีค', month: 3 },
  { pattern: 'เมษายน', month: 4 },
  { pattern: 'เม.ย.', month: 4 },
  { pattern: 'เมย', month: 4 },
  { pattern: 'พฤษภาคม', month: 5 },
  { pattern: 'พ.ค.', month: 5 },
  { pattern: 'พค', month: 5 },
  { pattern: 'มิถุนายน', month: 6 },
  { pattern: 'มิ.ย.', month: 6 },
  { pattern: 'มิย', month: 6 },
  { pattern: 'กรกฎาคม', month: 7 },
  { pattern: 'ก.ค.', month: 7 },
  { pattern: 'กค', month: 7 },
  { pattern: 'สิงหาคม', month: 8 },
  { pattern: 'ส.ค.', month: 8 },
  { pattern: 'สค', month: 8 },
  { pattern: 'กันยายน', month: 9 },
  { pattern: 'ก.ย.', month: 9 },
  { pattern: 'กย', month: 9 },
  { pattern: 'ตุลาคม', month: 10 },
  { pattern: 'ต.ค.', month: 10 },
  { pattern: 'ตค', month: 10 },
  { pattern: 'พฤศจิกายน', month: 11 },
  { pattern: 'พ.ย.', month: 11 },
  { pattern: 'พย', month: 11 },
  { pattern: 'ธันวาคม', month: 12 },
  { pattern: 'ธ.ค.', month: 12 },
  { pattern: 'ธค', month: 12 },
];

function normalizeDetectedYear(rawYear: number): number | null {
  let y = rawYear;
  if (y >= 2400 && y <= 2700) {
    y -= 543;
  }
  if (y >= 2000 && y <= 2100) return y;
  return null;
}

function formatCycleKey(year: number | null, month: number): string | undefined {
  if (!year || month < 1 || month > 12) return undefined;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Guesses YYYY-MM cycle key purely from an uploaded file name
 * (e.g., "012026.pdf" -> "2026-01", "2026-01_slip.pdf" -> "2026-01", "2569-11.jpg" -> "2026-11").
 */
export function detectCycleKeyFromFileName(fileName?: string): string | undefined {
  const raw = (fileName || '').trim();
  if (!raw) return undefined;

  // Strip extension to avoid trailing digits/characters interfering
  const name = raw.replace(/\.[^.]+$/, '');

  // 1. YYYY-MM / YYYY_MM / YYYY/MM (CE or BE)
  const isoMatch = /(?:^|\D)(20\d{2}|25\d{2})[-_/](0?[1-9]|1[0-2])(?:\D|$)/.exec(name);
  if (isoMatch) {
    const res = formatCycleKey(normalizeDetectedYear(Number(isoMatch[1])), Number(isoMatch[2]));
    if (res) return res;
  }

  // 2. MM-YYYY / MM_YYYY / MM/YYYY (CE or BE)
  const mmyyyySepMatch = /(?:^|\D)(0?[1-9]|1[0-2])[-_/](20\d{2}|25\d{2})(?:\D|$)/.exec(name);
  if (mmyyyySepMatch) {
    const res = formatCycleKey(
      normalizeDetectedYear(Number(mmyyyySepMatch[2])),
      Number(mmyyyySepMatch[1])
    );
    if (res) return res;
  }

  // 3. Compact MMYYYY (e.g. 012026, 112569)
  const compactMmYyyy = /(?:^|\D)(0[1-9]|1[0-2])(20\d{2}|25\d{2})(?:\D|$)/.exec(name);
  if (compactMmYyyy) {
    const res = formatCycleKey(
      normalizeDetectedYear(Number(compactMmYyyy[2])),
      Number(compactMmYyyy[1])
    );
    if (res) return res;
  }

  // 4. Compact YYYYMM (e.g. 202601, 256911)
  const compactYyyyMm = /(?:^|\D)(20\d{2}|25\d{2})(0[1-9]|1[0-2])(?:\D|$)/.exec(name);
  if (compactYyyyMm) {
    const res = formatCycleKey(
      normalizeDetectedYear(Number(compactYyyyMm[1])),
      Number(compactYyyyMm[2])
    );
    if (res) return res;
  }

  // 5. English month + year (e.g. Nov2026, 2026_Jan)
  const lower = name.toLowerCase();
  const engMonthFirst =
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)[-_.\s]*(20\d{2}|25\d{2})\b/.exec(
      lower
    );
  if (engMonthFirst) {
    const month = ENG_MONTH_MAP[engMonthFirst[1]];
    const res = formatCycleKey(normalizeDetectedYear(Number(engMonthFirst[2])), month);
    if (res) return res;
  }

  const engYearFirst =
    /\b(20\d{2}|25\d{2})[-_.\s]*(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/.exec(
      lower
    );
  if (engYearFirst) {
    const month = ENG_MONTH_MAP[engYearFirst[2]];
    const res = formatCycleKey(normalizeDetectedYear(Number(engYearFirst[1])), month);
    if (res) return res;
  }

  // 6. Thai month + year (e.g. ม.ค.2569, พฤศจิกายน_2026)
  for (const { pattern, month } of THAI_MONTH_MAP) {
    const idx = name.indexOf(pattern);
    if (idx !== -1) {
      const yearMatch = /(20\d{2}|25\d{2})/.exec(name);
      if (yearMatch) {
        const res = formatCycleKey(normalizeDetectedYear(Number(yearMatch[1])), month);
        if (res) return res;
      }
    }
  }

  return undefined;
}

export function isPdfPaySlipFile(file: File): boolean {
  const typeLower = (file.type || '').toLowerCase();
  const nameLower = (file.name || '').toLowerCase();
  return typeLower === 'application/pdf' || nameLower.endsWith('.pdf');
}

function compressRenderedCanvasToJpeg(
  sourceCanvas: HTMLCanvasElement,
  maxTargetBytes = TARGET_MAX_IMAGE_BYTES
): {
  dataUrl: string;
  fileSizeBytes: number;
  width: number;
  height: number;
} {
  let workingCanvas = sourceCanvas;
  let quality = 0.88;
  let dataUrl = workingCanvas.toDataURL('image/jpeg', quality);
  let byteSize = estimateDataUrlByteSize(dataUrl);

  for (let attempt = 0; attempt < 8 && byteSize > maxTargetBytes; attempt++) {
    if (quality > 0.56) {
      quality = Number((quality - 0.1).toFixed(2));
    } else {
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = Math.max(600, Math.round(workingCanvas.width * 0.82));
      nextCanvas.height = Math.max(600, Math.round(workingCanvas.height * 0.82));
      const nextCtx = nextCanvas.getContext('2d');
      if (!nextCtx) break;
      nextCtx.fillStyle = '#ffffff';
      nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
      nextCtx.drawImage(workingCanvas, 0, 0, nextCanvas.width, nextCanvas.height);
      workingCanvas = nextCanvas;
      quality = 0.78;
    }

    dataUrl = workingCanvas.toDataURL('image/jpeg', quality);
    byteSize = estimateDataUrlByteSize(dataUrl);
  }

  if (dataUrl.length > 820000) {
    throw new Error('ไฟล์ PDF มีความละเอียดสูงเกินขีดจำกัดหลังแปลงเป็นภาพ');
  }

  return {
    dataUrl,
    fileSizeBytes: byteSize,
    width: workingCanvas.width,
    height: workingCanvas.height,
  };
}

/**
 * Renders page 1 of an uploaded PDF pay slip onto an HTML Canvas (client-side via pdfjs-dist)
 * and compresses it into a crisp JPEG Data URL for storage and preview.
 */
export async function processPaySlipPdfFile(file: File): Promise<ProcessedPaySlipPdfResult> {
  if (!isPdfPaySlipFile(file)) {
    throw new Error('กรุณาเลือกไฟล์นามสกุล .pdf');
  }
  if (file.size > MAX_RAW_PDF_BYTES) {
    throw new Error('ไฟล์ PDF มีขนาดใหญ่เกิน 25 MB');
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  if (!pdfDoc || pdfDoc.numPages < 1) {
    throw new Error('ไม่พบหน้าเอกสารภายในไฟล์ PDF');
  }

  const firstPage = await pdfDoc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('เบราว์เซอร์ไม่รองรับการเรนเดอร์ไฟล์ PDF');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await firstPage.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;

  const compressed = compressRenderedCanvasToJpeg(canvas);

  return {
    dataUrl: compressed.dataUrl,
    mimeType: 'image/jpeg',
    fileSizeBytes: compressed.fileSizeBytes,
    width: compressed.width,
    height: compressed.height,
    detectedCycleKey: detectCycleKeyFromFileName(file.name),
  };
}
