import React, {useRef, useState} from 'react';
import {AlertCircle, CheckCircle2, Download, Upload, X} from 'lucide-react';
import {KnowHowItem, StoredImage, TodoItem, WorkspaceExport} from '../types';
import {exportWorkspaceToJson, importWorkspaceFromJson} from '../db/indexedDb';
import {formatBytes} from '../utils/imageOptimizer';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  todos: TodoItem[];
  knowhows: KnowHowItem[];
  images: StoredImage[];
  onImported: (data: {
    todos: TodoItem[];
    knowhows: KnowHowItem[];
    images: StoredImage[];
    folders: string[];
  }) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  todos,
  knowhows,
  images,
  onImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; text: string} | null>(null);
  const [pendingImport, setPendingImport] = useState<WorkspaceExport | null>(null);

  if (!isOpen) return null;

  const totalImageBytes = images.reduce((acc, img) => acc + (img.size || 0), 0);

  const handleExport = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const payload = await exportWorkspaceToJson();
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `dizin-yedek-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setFeedback({
        type: 'success',
        text: `Yedek dosyası indirildi (${payload.todos.length} görev, ${payload.knowhows.length} Know-How, ${payload.images.length} görsel).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Dışa aktarma sırasında hata oluştu.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as WorkspaceExport;
      if (
        !parsed ||
        !Array.isArray(parsed.todos) ||
        !Array.isArray(parsed.knowhows) ||
        !Array.isArray(parsed.images)
      ) {
        throw new Error('Seçilen dosya geçerli bir Dizin JSON yedeği değil.');
      }
      setPendingImport(parsed);
    } catch (err) {
      setPendingImport(null);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'JSON dosyası okunamadı.',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    setFeedback(null);
    try {
      const restored = await importWorkspaceFromJson(pendingImport);
      onImported(restored);
      setPendingImport(null);
      setFeedback({
        type: 'success',
        text: `Veritabanı başarıyla geri yüklendi (${restored.todos.length} görev, ${restored.knowhows.length} Know-How, ${restored.images.length} görsel).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Geri yükleme başarısız oldu.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Yedekle ve Geri Yükle"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Yedekle ve Geri Yükle
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Tüm görevler, Know-How kayıtları ve görseller tarayıcıdaki IndexedDB üzerinde tutulur.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          {/* Current database summary */}
          <div className="grid grid-cols-3 divide-x divide-zinc-200 rounded-lg border border-zinc-200 bg-zinc-50 py-3 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="px-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Görevler</div>
              <div className="mt-0.5 font-mono text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                {todos.length}
              </div>
            </div>
            <div className="px-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Know-How</div>
              <div className="mt-0.5 font-mono text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                {knowhows.length}
              </div>
            </div>
            <div className="px-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Görseller</div>
              <div className="mt-0.5 font-mono text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                {images.length}{' '}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  ({formatBytes(totalImageBytes)})
                </span>
              </div>
            </div>
          </div>

          {/* Export action */}
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Veritabanını Dışa Aktar
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Tüm kayıtları ve ekli görselleri tek bir <code className="font-mono">.json</code> dosyası olarak bilgisayarınıza indirin.
              </p>
            </div>
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>JSON Olarak Dışa Aktar</span>
              </button>
            </div>
          </div>

          {/* Import action */}
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Yedekten Geri Yükle
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Daha önce aldığınız <code className="font-mono">.json</code> dosyasını seçin. Mevcut yerel veriler yedekteki kayıtlarla değiştirilir.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFilePick}
              className="hidden"
            />

            {!pendingImport ? (
              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>JSON Dosyası Seç</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <strong>Onay Gerekli:</strong> Seçilen yedekte{' '}
                  <span className="font-mono tabular-nums">{pendingImport.todos.length}</span> görev,{' '}
                  <span className="font-mono tabular-nums">{pendingImport.knowhows.length}</span> Know-How ve{' '}
                  <span className="font-mono tabular-nums">{pendingImport.images.length}</span> görsel bulunuyor. Mevcut verilerin üzerine yazılsın mı?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmImport}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    Evet, Geri Yükle
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPendingImport(null)}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 whitespace-nowrap"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
