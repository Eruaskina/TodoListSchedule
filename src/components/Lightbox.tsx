import React, {useEffect, useState} from 'react';
import {ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut} from 'lucide-react';
import {StoredImage} from '../types';
import {formatBytes} from '../utils/imageOptimizer';

interface LightboxProps {
  images: StoredImage[];
  imageUrls: Record<string, string>;
  activeImageId: string | null;
  onClose: () => void;
  onSelectImage: (id: string) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  imageUrls,
  activeImageId,
  onClose,
  onSelectImage,
}) => {
  const [zoomed, setZoomed] = useState(false);

  const currentIndex = images.findIndex((img) => img.id === activeImageId);
  const currentImage = currentIndex >= 0 ? images[currentIndex] : null;

  useEffect(() => {
    setZoomed(false);
  }, [activeImageId]);

  useEffect(() => {
    if (!activeImageId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        const next = (currentIndex + 1) % images.length;
        onSelectImage(images[next].id);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        const prev = (currentIndex - 1 + images.length) % images.length;
        onSelectImage(images[prev].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageId, currentIndex, images, onClose, onSelectImage]);

  if (!activeImageId || !currentImage) return null;

  const url = imageUrls[currentImage.id];
  if (!url) return null;

  const goPrev = () => {
    const prev = (currentIndex - 1 + images.length) % images.length;
    onSelectImage(images[prev].id);
  };

  const goNext = () => {
    const next = (currentIndex + 1) % images.length;
    onSelectImage(images[next].id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/92 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Görsel Önizleme"
      onClick={onClose}
    >
      {/* Top toolbar */}
      <div
        className="flex items-center justify-between border-b border-zinc-800 px-5 py-3 text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-3 text-xs">
          <span className="truncate font-medium text-zinc-100">{currentImage.name}</span>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <span className="font-mono text-zinc-400 tabular-nums whitespace-nowrap">
            {currentImage.width} × {currentImage.height}px
          </span>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <span className="font-mono text-zinc-400 tabular-nums whitespace-nowrap">
            {formatBytes(currentImage.size)}
          </span>
          {images.length > 1 && (
            <>
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <span className="font-mono text-zinc-400 tabular-nums whitespace-nowrap">
                {currentIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 whitespace-nowrap"
          >
            {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
            <span>{zoomed ? 'Sığdır' : 'Yakınlaştır'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 transition-colors hover:bg-zinc-800"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main image canvas */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-auto p-6"
        onClick={onClose}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="fixed left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/90 text-zinc-100 transition-colors hover:bg-zinc-800"
            aria-label="Önceki görsel"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <img
          src={url}
          alt={currentImage.name}
          referrerPolicy="no-referrer"
          onClick={(e) => {
            e.stopPropagation();
            setZoomed((z) => !z);
          }}
          className={`rounded-md transition-transform duration-150 ${
            zoomed
              ? 'max-w-none cursor-zoom-out'
              : 'max-h-[82vh] max-w-[88vw] cursor-zoom-in object-contain'
          }`}
        />

        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="fixed right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/90 text-zinc-100 transition-colors hover:bg-zinc-800"
            aria-label="Sonraki görsel"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};
