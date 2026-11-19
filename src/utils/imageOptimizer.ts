export interface OptimizedImageResult {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  name: string;
}

const MAX_IMAGE_DIMENSION = 1600;

function loadImageFromFile(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export async function optimizeImageFile(
  file: File | Blob,
  fallbackName = 'gorsel.webp'
): Promise<OptimizedImageResult> {
  const originalName = file instanceof File && file.name ? file.name : fallbackName;
  const img = await loadImageFromFile(file);

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (srcWidth > MAX_IMAGE_DIMENSION || srcHeight > MAX_IMAGE_DIMENSION) {
    if (srcWidth >= srcHeight) {
      targetWidth = MAX_IMAGE_DIMENSION;
      targetHeight = Math.max(1, Math.round((srcHeight * MAX_IMAGE_DIMENSION) / srcWidth));
    } else {
      targetHeight = MAX_IMAGE_DIMENSION;
      targetWidth = Math.max(1, Math.round((srcWidth * MAX_IMAGE_DIMENSION) / srcHeight));
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Görsel işleme bağlamı oluşturulamadı.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Preserve transparency for PNG if needed, otherwise encode to WebP/JPEG
  const isPng = file.type === 'image/png';
  const targetMime = isPng ? 'image/webp' : 'image/webp';

  const encodedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), targetMime, 0.84);
  });

  // Fallback to JPEG if browser lacks WebP encoding
  const finalBlob =
    encodedBlob ??
    (await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
    }));

  if (!finalBlob) {
    throw new Error('Görsel sıkıştırılamadı.');
  }

  // If the original file was already small and smaller than re-encoded (and within bounds), keep original
  const withinBounds = srcWidth <= MAX_IMAGE_DIMENSION && srcHeight <= MAX_IMAGE_DIMENSION;
  const chosenBlob = withinBounds && file.size < finalBlob.size ? file : finalBlob;

  return {
    blob: chosenBlob,
    mimeType: chosenBlob.type || 'image/webp',
    width: targetWidth,
    height: targetHeight,
    size: chosenBlob.size,
    name: originalName,
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Görsel base64 formatına dönüştürülemedi.'));
      }
    };
    reader.onerror = () => reject(new Error('Dosya okuma hatası.'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
