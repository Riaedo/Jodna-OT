export interface CompressedImageResult {
  dataUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024; // 20 MB raw guard
const DEFAULT_MAX_BYTES = 420 * 1024; // ~420 KB target to fit Firestore & LocalStorage safely

export function isSupportedPaySlipFile(file: File): boolean {
  const typeLower = (file.type || '').toLowerCase();
  if (ACCEPTED_IMAGE_TYPES.has(typeLower)) return true;
  const nameLower = (file.name || '').toLowerCase();
  return nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png');
}

export function estimateDataUrlByteSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.ceil((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
      }
    };
    reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์รูปภาพ'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้องหรือไม่สามารถเปิดอ่านได้'));
    img.src = src;
  });
}

/**
 * Compresses and resizes a JPG/PNG pay slip photo client-side so that it stays crisp
 * for A4 PDF output while fitting reliably under Firestore 1MB & LocalStorage limits.
 */
export async function compressPaySlipImage(
  file: File,
  options?: { maxDimension?: number; maxTargetBytes?: number }
): Promise<CompressedImageResult> {
  if (!isSupportedPaySlipFile(file)) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ JPG และ PNG เท่านั้น');
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error('ขนาดไฟล์รูปภาพใหญ่เกิน 20 MB กรุณาเลือกรูปภาพขนาดเล็กลง');
  }

  const maxTargetBytes = options?.maxTargetBytes ?? DEFAULT_MAX_BYTES;
  let maxDim = options?.maxDimension ?? 1400;

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);

  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;
  if (!origWidth || !origHeight) {
    throw new Error('ไม่พบความละเอียดของรูปภาพ');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ');
  }

  let quality = 0.84;
  let resultDataUrl = '';
  let targetW = origWidth;
  let targetH = origHeight;

  for (let attempt = 0; attempt < 7; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(origWidth, origHeight));
    targetW = Math.max(1, Math.round(origWidth * scale));
    targetH = Math.max(1, Math.round(origHeight * scale));

    canvas.width = targetW;
    canvas.height = targetH;

    // Fill white background so transparent PNG pay slips never turn black in JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    resultDataUrl = canvas.toDataURL('image/jpeg', quality);
    const byteSize = estimateDataUrlByteSize(resultDataUrl);

    if (byteSize <= maxTargetBytes) {
      return {
        dataUrl: resultDataUrl,
        mimeType: 'image/jpeg',
        fileSizeBytes: byteSize,
        width: targetW,
        height: targetH,
      };
    }

    if (quality > 0.52) {
      quality = Number((quality - 0.1).toFixed(2));
    } else {
      maxDim = Math.max(760, Math.round(maxDim * 0.8));
      quality = 0.72;
    }
  }

  const finalBytes = estimateDataUrlByteSize(resultDataUrl);
  if (resultDataUrl.length > 820000) {
    throw new Error('รูปภาพมีขนาดใหญ่เกินขีดจำกัดหลังการบีบอัด กรุณาถ่ายหรือครอปเฉพาะส่วนสลิป');
  }

  return {
    dataUrl: resultDataUrl,
    mimeType: 'image/jpeg',
    fileSizeBytes: finalBytes,
    width: targetW,
    height: targetH,
  };
}
