import React from 'react';
import {ArrowUpRight, X} from 'lucide-react';
import {KnowHowItem, StoredImage} from '../types';
import {MarkdownRenderer} from '../utils/markdown';
import {formatTurkishDate} from '../utils/labels';

interface KnowHowPreviewModalProps {
  knowhow: KnowHowItem | null;
  allKnowHows: KnowHowItem[];
  images: StoredImage[];
  imageUrls: Record<string, string>;
  onClose: () => void;
  onOpenInKnowHowModule: (id: string) => void;
  onNavigatePreview: (title: string) => void;
  onOpenLightbox: (imageId: string, scopeImages: StoredImage[]) => void;
}

export const KnowHowPreviewModal: React.FC<KnowHowPreviewModalProps> = ({
  knowhow,
  allKnowHows,
  images,
  imageUrls,
  onClose,
  onOpenInKnowHowModule,
  onNavigatePreview,
  onOpenLightbox,
}) => {
  if (!knowhow) return null;

  const attachedImages = knowhow.imageIds
    .map((id) => images.find((img) => img.id === id))
    .filter((img): img is StoredImage => Boolean(img));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Önizleme: ${knowhow.title}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {knowhow.title}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>Son güncelleme: {formatTurkishDate(knowhow.updatedAt)}</span>
              {knowhow.tags.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{knowhow.tags.map((t) => `#${t}`).join(' · ')}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenInKnowHowModule(knowhow.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
            >
              <span>Know-How&apos;da Aç</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <MarkdownRenderer
            content={knowhow.content}
            imageUrls={imageUrls}
            knowHowTitles={allKnowHows.map((k) => k.title)}
            onWikiLinkClick={onNavigatePreview}
            onImageClick={(id) => onOpenLightbox(id, attachedImages.length ? attachedImages : images)}
          />

          {attachedImages.length > 0 && (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Ekli Görseller ({attachedImages.length})
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attachedImages.map((img) => {
                  const url = imageUrls[img.id];
                  if (!url) return null;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => onOpenLightbox(img.id, attachedImages)}
                      className="group overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-left transition-colors hover:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <img
                        src={url}
                        alt={img.name}
                        referrerPolicy="no-referrer"
                        className="h-28 w-full object-cover transition-transform duration-150 group-hover:scale-[1.03]"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
