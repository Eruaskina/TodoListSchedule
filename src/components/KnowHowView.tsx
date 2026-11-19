import React, {useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Columns2,
  Eye,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  Layers,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {KnowHowItem, StoredImage, TodoItem} from '../types';
import {extractWikiLinkTitles} from '../db/indexedDb';
import {formatBytes} from '../utils/imageOptimizer';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  formatTurkishDate,
  normalizeCategory,
  normalizeTag,
} from '../utils/labels';
import {MarkdownRenderer} from '../utils/markdown';

interface KnowHowViewProps {
  knowhows: KnowHowItem[];
  todos: TodoItem[];
  images: StoredImage[];
  imageUrls: Record<string, string>;
  folders: string[];
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (name: string) => Promise<void>;
  selectedKnowHowId: string | null;
  onSelectKnowHow: (id: string | null) => void;
  onCreateKnowHow: (initialCategory?: string) => Promise<KnowHowItem>;
  onUpdateKnowHow: (item: KnowHowItem) => Promise<void>;
  onDeleteKnowHow: (id: string) => Promise<void>;
  onUploadImagesToKnowHow: (knowHowId: string, files: File[]) => Promise<StoredImage[]>;
  onDeleteImageFromKnowHow: (knowHowId: string, imageId: string) => Promise<void>;
  onOpenLightbox: (imageId: string, scopeImages: StoredImage[]) => void;
  onOpenTodo: (todoId: string) => void;
  searchQuery: string;
}

type EditorViewMode = 'edit' | 'preview' | 'split';
type FolderFilter = '__all__' | '__uncategorized__' | string;

export const KnowHowView: React.FC<KnowHowViewProps> = ({
  knowhows,
  todos,
  images,
  imageUrls,
  folders,
  onCreateFolder,
  onDeleteFolder,
  selectedKnowHowId,
  onSelectKnowHow,
  onCreateKnowHow,
  onUpdateKnowHow,
  onDeleteKnowHow,
  onUploadImagesToKnowHow,
  onDeleteImageFromKnowHow,
  onOpenLightbox,
  onOpenTodo,
  searchQuery,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<FolderFilter>('__all__');
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [localSearch, setLocalSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [viewMode, setViewMode] = useState<EditorViewMode>('edit');
  const [tagDraft, setTagDraft] = useState('');
  const [customCategoryDraft, setCustomCategoryDraft] = useState('');
  const [editingCustomCategory, setEditingCustomCategory] = useState(false);

  const [relatedSearch, setRelatedSearch] = useState('');
  const [showRelatedPicker, setShowRelatedPicker] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // [[ Wiki-link autocomplete state
  const [wikiTrigger, setWikiTrigger] = useState<{
    startIndex: number;
    query: string;
  } | null>(null);
  const [wikiActiveIndex, setWikiActiveIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDoc = useMemo(
    () => knowhows.find((k) => k.id === selectedKnowHowId) ?? null,
    [knowhows, selectedKnowHowId]
  );

  // Merge explicitly saved folders + categories used on documents
  const folderEntries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of folders) {
      const cleaned = normalizeCategory(f);
      if (cleaned) counts.set(cleaned, 0);
    }
    let uncategorizedCount = 0;
    for (const k of knowhows) {
      const cat = normalizeCategory(k.category);
      if (!cat) {
        uncategorizedCount += 1;
      } else {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    const list = Array.from(counts.entries())
      .map(([name, count]) => ({name, count}))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
    return {list, uncategorizedCount};
  }, [folders, knowhows]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const k of knowhows) {
      for (const t of k.tags) tagSet.add(t);
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [knowhows]);

  const filteredKnowHows = useMemo(() => {
    const q = (localSearch || searchQuery).trim().toLocaleLowerCase('tr-TR');
    return knowhows.filter((k) => {
      const docCat = normalizeCategory(k.category);
      if (selectedFolder === '__uncategorized__' && docCat !== '') {
        return false;
      }
      if (
        selectedFolder !== '__all__' &&
        selectedFolder !== '__uncategorized__' &&
        docCat !== selectedFolder
      ) {
        return false;
      }
      if (selectedTag !== 'all' && !k.tags.includes(selectedTag)) {
        return false;
      }
      if (q) {
        const haystack = `${k.title} ${docCat} ${k.content} ${k.tags.join(' ')}`.toLocaleLowerCase('tr-TR');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [knowhows, selectedFolder, localSearch, searchQuery, selectedTag]);

  const attachedImages = useMemo(() => {
    if (!activeDoc) return [];
    return activeDoc.imageIds
      .map((id) => images.find((img) => img.id === id))
      .filter((img): img is StoredImage => Boolean(img));
  }, [activeDoc, images]);

  const wikiSuggestions = useMemo(() => {
    if (!wikiTrigger || !activeDoc) return [];
    const q = wikiTrigger.query.trim().toLocaleLowerCase('tr-TR');
    return knowhows
      .filter((k) => k.id !== activeDoc.id)
      .filter((k) => !q || k.title.toLocaleLowerCase('tr-TR').includes(q))
      .slice(0, 8);
  }, [wikiTrigger, knowhows, activeDoc]);

  const outgoingRelated = useMemo(() => {
    if (!activeDoc) return [];
    const ids = new Set(activeDoc.relatedKnowHowIds);
    const mentionedTitles = extractWikiLinkTitles(activeDoc.content).map((t) =>
      t.toLowerCase()
    );
    return knowhows.filter((k) => {
      if (k.id === activeDoc.id) return false;
      return ids.has(k.id) || mentionedTitles.includes(k.title.trim().toLowerCase());
    });
  }, [activeDoc, knowhows]);

  const backlinkKnowHows = useMemo(() => {
    if (!activeDoc) return [];
    const targetTitleLower = activeDoc.title.trim().toLowerCase();
    return knowhows.filter((k) => {
      if (k.id === activeDoc.id) return false;
      const explicitMatch = k.relatedKnowHowIds.includes(activeDoc.id);
      const inlineTitles = extractWikiLinkTitles(k.content).map((t) => t.toLowerCase());
      const inlineMatch = Boolean(targetTitleLower && inlineTitles.includes(targetTitleLower));
      return explicitMatch || inlineMatch;
    });
  }, [activeDoc, knowhows]);

  const linkedTodos = useMemo(() => {
    if (!activeDoc) return [];
    return todos
      .filter((t) => t.linkedKnowHowIds.includes(activeDoc.id))
      .sort((a, b) => Number(a.completed) - Number(b.completed) || b.updatedAt - a.updatedAt);
  }, [activeDoc, todos]);

  const availableRelatedToAdd = useMemo(() => {
    if (!activeDoc) return [];
    const q = relatedSearch.trim().toLocaleLowerCase('tr-TR');
    return knowhows.filter((k) => {
      if (k.id === activeDoc.id) return false;
      if (activeDoc.relatedKnowHowIds.includes(k.id)) return false;
      if (!q) return true;
      return (
        k.title.toLocaleLowerCase('tr-TR').includes(q) ||
        k.tags.some((t) => t.toLocaleLowerCase('tr-TR').includes(q))
      );
    });
  }, [activeDoc, knowhows, relatedSearch]);

  const updateActiveDoc = async (patch: Partial<KnowHowItem>) => {
    if (!activeDoc) return;
    await onUpdateKnowHow({
      ...activeDoc,
      ...patch,
      updatedAt: Date.now(),
    });
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeCategory(newFolderName);
    if (!cleaned) return;
    await onCreateFolder(cleaned);
    setSelectedFolder(cleaned);
    setNewFolderName('');
    setAddingFolder(false);
  };

  const handleAssignCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc) return;
    const cleaned = normalizeCategory(customCategoryDraft);
    if (cleaned) {
      await onCreateFolder(cleaned);
      await updateActiveDoc({category: cleaned});
    }
    setCustomCategoryDraft('');
    setEditingCustomCategory(false);
  };

  const handleContentChange = (nextContent: string, cursorPos: number) => {
    updateActiveDoc({content: nextContent});

    const textBeforeCursor = nextContent.slice(0, cursorPos);
    const lastOpen = textBeforeCursor.lastIndexOf('[[');
    const lastClose = textBeforeCursor.lastIndexOf(']]');

    if (lastOpen !== -1 && lastOpen > lastClose) {
      const query = textBeforeCursor.slice(lastOpen + 2);
      if (!query.includes('\n') && query.length <= 60) {
        setWikiTrigger({startIndex: lastOpen, query});
        setWikiActiveIndex(0);
        return;
      }
    }
    setWikiTrigger(null);
  };

  const insertWikiLinkSuggestion = (target: KnowHowItem) => {
    if (!activeDoc || !wikiTrigger) return;
    const el = textareaRef.current;
    const cursorPos = el ? el.selectionStart : activeDoc.content.length;
    const before = activeDoc.content.slice(0, wikiTrigger.startIndex);
    const after = activeDoc.content.slice(cursorPos);
    const inserted = `[[${target.title}]]`;
    const nextContent = `${before}${inserted}${after}`;

    const nextRelated = activeDoc.relatedKnowHowIds.includes(target.id)
      ? activeDoc.relatedKnowHowIds
      : [...activeDoc.relatedKnowHowIds, target.id];

    updateActiveDoc({content: nextContent, relatedKnowHowIds: nextRelated});
    setWikiTrigger(null);

    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const nextCursor = before.length + inserted.length;
        el.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!wikiTrigger || wikiSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setWikiActiveIndex((i) => (i + 1) % wikiSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setWikiActiveIndex((i) => (i - 1 + wikiSuggestions.length) % wikiSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const chosen = wikiSuggestions[wikiActiveIndex] ?? wikiSuggestions[0];
      if (chosen) insertWikiLinkSuggestion(chosen);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setWikiTrigger(null);
    }
  };

  const handleImageFiles = async (files: File[]) => {
    if (!activeDoc || files.length === 0) return;
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const saved = await onUploadImagesToKnowHow(activeDoc.id, imageFiles);
    if (saved.length > 0) {
      setUploadNotice(
        `${saved.length} görsel optimize edildi (maks. 1600px) ve kaydedildi.`
      );
      setTimeout(() => setUploadNotice(null), 3200);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!activeDoc) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const pastedImages: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) pastedImages.push(file);
      }
    }
    if (pastedImages.length > 0) {
      e.preventDefault();
      await handleImageFiles(pastedImages);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    await handleImageFiles(files);
  };

  const insertImageMarkdownAtCursor = (imageId: string, name: string) => {
    if (!activeDoc) return;
    const snippet = `\n![${name}](img:${imageId})\n`;
    const el = textareaRef.current;
    if (!el || viewMode === 'preview') {
      updateActiveDoc({content: `${activeDoc.content}${snippet}`});
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextContent =
      activeDoc.content.slice(0, start) + snippet + activeDoc.content.slice(end);
    updateActiveDoc({content: nextContent});
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleWikiLinkNavigate = async (title: string) => {
    const existing = knowhows.find(
      (k) => k.title.trim().toLowerCase() === title.trim().toLowerCase()
    );
    if (existing) {
      onSelectKnowHow(existing.id);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc) return;
    const cleaned = normalizeTag(tagDraft);
    if (!cleaned) return;
    if (!activeDoc.tags.includes(cleaned)) {
      await updateActiveDoc({tags: [...activeDoc.tags, cleaned]});
    }
    setTagDraft('');
  };

  const handleRemoveTag = async (tag: string) => {
    if (!activeDoc) return;
    await updateActiveDoc({
      tags: activeDoc.tags.filter((t) => t !== tag),
    });
  };

  const handleToggleMarkdownCheckbox = async (lineIndex: number, nextChecked: boolean) => {
    if (!activeDoc) return;
    const lines = activeDoc.content.split('\n');
    if (!lines[lineIndex]) return;
    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*[-*]\s+)\[( |x|X)\]/,
      `$1[${nextChecked ? 'x' : ' '}]`
    );
    await updateActiveDoc({content: lines.join('\n')});
  };

  const initialCategoryForNewDoc =
    selectedFolder !== '__all__' && selectedFolder !== '__uncategorized__'
      ? selectedFolder
      : undefined;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Desktop Folder / Category Sidebar Menu */}
      <aside
        className="hidden w-52 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/70 lg:flex dark:border-zinc-800 dark:bg-zinc-950/80"
        aria-label="Klasör ve Kategori Menüsü"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-3.5 py-3 dark:border-zinc-800">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Klasörler
          </span>
          <button
            type="button"
            onClick={() => setAddingFolder((v) => !v)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 whitespace-nowrap"
            title="Yeni klasör oluştur"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Yeni</span>
          </button>
        </div>

        {addingFolder && (
          <form
            onSubmit={handleCreateFolderSubmit}
            className="border-b border-zinc-200 p-2.5 space-y-1.5 dark:border-zinc-800"
          >
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Klasör adı..."
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="flex-1 rounded bg-blue-600 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-45"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingFolder(false);
                  setNewFolderName('');
                }}
                className="rounded border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                İptal
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            type="button"
            onClick={() => setSelectedFolder('__all__')}
            className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
              selectedFolder === '__all__'
                ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800'
                : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Layers className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate">Tüm Dokümanlar</span>
            </span>
            <span className="ml-2 font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
              {knowhows.length}
            </span>
          </button>

          {folderEntries.list.map((folder) => {
            const isActive = selectedFolder === folder.name;
            return (
              <div
                key={folder.name}
                className={`group flex items-center justify-between rounded-md transition-colors ${
                  isActive
                    ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800'
                    : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFolder(folder.name)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs font-medium"
                >
                  {isActive ? (
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  )}
                  <span className="truncate">{folder.name}</span>
                </button>

                <div className="flex items-center gap-1 pr-2 shrink-0">
                  {folder.count === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedFolder === folder.name) {
                          setSelectedFolder('__all__');
                        }
                        onDeleteFolder(folder.name);
                      }}
                      className="hidden rounded p-0.5 text-zinc-400 hover:text-red-600 group-hover:inline-flex dark:hover:text-red-400"
                      title="Boş klasörü sil"
                      aria-label={`${folder.name} klasörünü sil`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                    {folder.count}
                  </span>
                </div>
              </div>
            );
          })}

          {folderEntries.uncategorizedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedFolder('__uncategorized__')}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                selectedFolder === '__uncategorized__'
                  ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800'
                  : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="truncate">Kategorisiz</span>
              </span>
              <span className="ml-2 font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                {folderEntries.uncategorizedCount}
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Document List Column */}
      <div
        className={`flex w-full flex-col border-r border-zinc-200 bg-white md:w-72 lg:w-76 shrink-0 dark:border-zinc-800 dark:bg-zinc-950 ${
          activeDoc ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="space-y-2.5 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {selectedFolder === '__all__'
                ? `Dokümanlar (${filteredKnowHows.length})`
                : selectedFolder === '__uncategorized__'
                ? `Kategorisiz (${filteredKnowHows.length})`
                : `${selectedFolder} (${filteredKnowHows.length})`}
            </h2>
            <button
              type="button"
              onClick={async () => {
                const created = await onCreateKnowHow(initialCategoryForNewDoc);
                onSelectKnowHow(created.id);
                setViewMode('edit');
              }}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span>Yeni Know-How</span>
            </button>
          </div>

          {/* Mobile / Tablet Folder Selector */}
          <div className="lg:hidden">
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              aria-label="Klasör filtresi"
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="__all__">Tüm Klasörler ({knowhows.length})</option>
              {folderEntries.list.map((f) => (
                <option key={f.name} value={f.name}>
                  Klasör: {f.name} ({f.count})
                </option>
              ))}
              {folderEntries.uncategorizedCount > 0 && (
                <option value="__uncategorized__">
                  Kategorisiz ({folderEntries.uncategorizedCount})
                </option>
              )}
            </select>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Başlık veya içerikte anlık ara..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              aria-label="Etiket filtresi"
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="all">Tüm Etiketler</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Document Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
          {filteredKnowHows.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <BookOpen className="mx-auto mb-2.5 h-7 w-7 text-zinc-300 dark:text-zinc-700" />
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Bu klasörde eşleşen kayıt yok
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Yeni bir Know-How dokümanı oluşturabilir veya klasör filtresini değiştirebilirsiniz.
              </p>
            </div>
          ) : (
            filteredKnowHows.map((doc) => {
              const isSelected = doc.id === activeDoc?.id;
              const plainExcerpt = doc.content
                .replace(/[#*`>[\]!()]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              const docCategory = normalizeCategory(doc.category);

              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    onSelectKnowHow(doc.id);
                    setConfirmDeleteId(null);
                    setWikiTrigger(null);
                  }}
                  className={`w-full px-4 py-3.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-100">
                      {doc.title || 'Başlıksız Know-How'}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
                      {formatTurkishDate(doc.updatedAt)}
                    </span>
                  </div>

                  {plainExcerpt && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {plainExcerpt}
                    </p>
                  )}

                  {(docCategory || doc.tags.length > 0 || doc.imageIds.length > 0) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {docCategory && (
                        <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                          <Folder className="h-3 w-3 shrink-0 text-zinc-400" />
                          <span>{docCategory}</span>
                        </span>
                      )}
                      {docCategory && doc.tags.length > 0 && <span aria-hidden="true">·</span>}
                      {doc.tags.length > 0 && (
                        <span className="truncate">
                          {doc.tags.map((t) => `#${t}`).join(' · ')}
                        </span>
                      )}
                      {doc.imageIds.length > 0 && (
                        <>
                          {(docCategory || doc.tags.length > 0) && <span aria-hidden="true">·</span>}
                          <span className="tabular-nums whitespace-nowrap">
                            {doc.imageIds.length} görsel
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Document Workspace */}
      {!activeDoc ? (
        <div className="hidden flex-1 flex-col items-center justify-center bg-zinc-50/40 p-8 text-center md:flex dark:bg-zinc-950">
          <BookOpen className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Bir Know-How seçin veya oluşturun
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Dokümanlarınızı klasörlere ayırın, Markdown ile yazın, <code className="font-mono">[[</code> ile birbirine bağlayın ve görselleri sürükleyip bırakın ya da <code className="font-mono">Ctrl+V</code> ile yapıştırın.
          </p>
        </div>
      ) : (
        <div
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950"
          onPaste={handlePaste}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDraggingOver(false);
          }}
          onDrop={handleDrop}
        >
          {/* Drag-and-drop overlay indicator */}
          {isDraggingOver && (
            <div className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-500 bg-blue-50/85 backdrop-blur-xs dark:bg-blue-950/75">
              <Upload className="mb-2 h-8 w-8 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Görselleri buraya bırakın
              </p>
              <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                Otomatik optimize edilip IndexedDB&apos;ye kaydedilir
              </p>
            </div>
          )}

          {/* Top Workspace Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectKnowHow(null)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 md:hidden dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Liste</span>
              </button>

              {/* View Mode Switch */}
              <div className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === 'edit'
                      ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Düzenle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`hidden xl:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === 'split'
                      ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  <span>Bölünmüş</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === 'preview'
                      ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Okuma</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  await handleImageFiles(files);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                <ImagePlus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Görsel Ekle</span>
              </button>

              {confirmDeleteId === activeDoc.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteKnowHow(activeDoc.id);
                      setConfirmDeleteId(null);
                    }}
                    className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    Evet, Sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(activeDoc.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  title="Know-How kaydını sil"
                  aria-label="Know-How kaydını sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Upload feedback notice */}
          {uploadNotice && (
            <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-6 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{uploadNotice}</span>
            </div>
          )}

          {/* Document Scrollable Area */}
          <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Document Title, Folder/Category & Tags */}
              <div className="space-y-3 border-b border-zinc-200 pb-5 dark:border-zinc-800">
                <input
                  type="text"
                  value={activeDoc.title}
                  onChange={(e) => updateActiveDoc({title: e.target.value})}
                  placeholder="Know-How başlığı..."
                  className="w-full border-0 bg-transparent p-0 text-2xl font-bold tracking-tight text-zinc-950 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50"
                />

                {/* Folder / Category & Tags Row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Folder / Category Selector */}
                  <div className="inline-flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-zinc-400" />
                    {editingCustomCategory ? (
                      <form
                        onSubmit={handleAssignCustomCategory}
                        className="inline-flex items-center gap-1"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={customCategoryDraft}
                          onChange={(e) => setCustomCategoryDraft(e.target.value)}
                          placeholder="Yeni klasör adı..."
                          className="w-32 rounded-md border border-blue-500 bg-white px-2 py-0.5 text-xs text-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <button
                          type="submit"
                          className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700"
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCustomCategory(false)}
                          className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <select
                        value={normalizeCategory(activeDoc.category)}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__new__') {
                            setEditingCustomCategory(true);
                            setCustomCategoryDraft('');
                          } else {
                            updateActiveDoc({category: val});
                          }
                        }}
                        aria-label="Doküman klasörü"
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        <option value="">Kategorisiz</option>
                        {folderEntries.list.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                        <option value="__new__">+ Yeni Klasör Oluştur...</option>
                      </select>
                    )}
                  </div>

                  <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                    ·
                  </span>

                  {activeDoc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                        aria-label={`${tag} etiketini kaldır`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  <form onSubmit={handleAddTag} className="inline-flex items-center">
                    <input
                      type="text"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      placeholder="+ Etiket ekle"
                      className="w-28 rounded-md border border-dashed border-zinc-300 bg-transparent px-2 py-0.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:text-zinc-200"
                    />
                  </form>

                  <span className="ml-auto font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
                    Güncellendi: {formatTurkishDate(activeDoc.updatedAt)}
                  </span>
                </div>
              </div>

              {/* Editor & Preview Surface */}
              <div
                className={
                  viewMode === 'split'
                    ? 'grid grid-cols-1 gap-6 xl:grid-cols-2'
                    : 'block'
                }
              >
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>
                        Markdown Editörü · <code className="font-mono">[[</code> yazarak başka bir Know-How bağlayın · <code className="font-mono">Ctrl+V</code> ile görsel yapıştırın
                      </span>
                    </div>

                    <textarea
                      ref={textareaRef}
                      rows={viewMode === 'split' ? 20 : 16}
                      value={activeDoc.content}
                      onChange={(e) =>
                        handleContentChange(e.target.value, e.target.selectionStart)
                      }
                      onKeyDown={handleTextareaKeyDown}
                      placeholder="Doküman içeriğini buraya yazın... Başka bir Know-How'a referans vermek için [[ yazabilirsiniz."
                      className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 font-sans text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-500 dark:focus:bg-zinc-900"
                    />

                    {/* [[ Wiki-link Autocomplete Popover */}
                    {wikiTrigger && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                        <div className="border-b border-zinc-100 px-3 py-1.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          Know-How Bağlantısı Ekle {wikiTrigger.query ? `("${wikiTrigger.query}")` : ''}
                        </div>
                        {wikiSuggestions.length === 0 ? (
                          <div className="px-3 py-2.5 text-xs text-zinc-400 dark:text-zinc-500">
                            Eşleşen Know-How kaydı bulunamadı.
                          </div>
                        ) : (
                          <ul className="max-h-52 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                            {wikiSuggestions.map((candidate, idx) => (
                              <li key={candidate.id}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    insertWikiLinkSuggestion(candidate);
                                  }}
                                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                                    idx === wikiActiveIndex
                                      ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100'
                                      : 'text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800'
                                  }`}
                                >
                                  <span className="truncate font-medium">
                                    {candidate.title}
                                  </span>
                                  {candidate.category && (
                                    <span className="shrink-0 text-[11px] text-zinc-400">
                                      {candidate.category}
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div
                    className={
                      viewMode === 'split'
                        ? 'rounded-lg border border-zinc-200 bg-zinc-50/40 p-5 dark:border-zinc-800 dark:bg-zinc-900/20'
                        : 'py-1'
                    }
                  >
                    {viewMode === 'split' && (
                      <div className="mb-3 border-b border-zinc-200 pb-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        Canlı Önizleme
                      </div>
                    )}
                    <MarkdownRenderer
                      content={activeDoc.content}
                      imageUrls={imageUrls}
                      knowHowTitles={knowhows.map((k) => k.title)}
                      onWikiLinkClick={handleWikiLinkNavigate}
                      onImageClick={(id) =>
                        onOpenLightbox(id, attachedImages.length ? attachedImages : images)
                      }
                      onToggleTaskLine={handleToggleMarkdownCheckbox}
                    />
                  </div>
                )}
              </div>

              {/* Media / Image Gallery Section */}
              <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Görseller ({attachedImages.length})
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Dosya seçebilir, bu alana sürükleyip bırakabilir veya <code className="font-mono">Ctrl+V</code> ile doğrudan yapıştırabilirsiniz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Görsel Yükle</span>
                  </button>
                </div>

                {attachedImages.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 py-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/30 dark:border-zinc-700 dark:bg-zinc-900/30 dark:hover:border-blue-500"
                  >
                    <ImagePlus className="mb-2 h-6 w-6 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Görsel eklemek için tıklayın veya sürükleyip bırakın
                    </span>
                    <span className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                      Maksimum 1600px genişliğe otomatik ölçeklenir
                    </span>
                  </button>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {attachedImages.map((img) => {
                      const url = imageUrls[img.id];
                      return (
                        <div
                          key={img.id}
                          className="group overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40"
                        >
                          <button
                            type="button"
                            onClick={() => onOpenLightbox(img.id, attachedImages)}
                            className="block h-36 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900"
                          >
                            {url ? (
                              <img
                                src={url}
                                alt={img.name}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                                Yükleniyor...
                              </div>
                            )}
                          </button>

                          <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                {img.name}
                              </div>
                              <div className="font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                                {img.width}×{img.height} · {formatBytes(img.size)}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => insertImageMarkdownAtCursor(img.id, img.name)}
                                className="rounded px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 whitespace-nowrap"
                                title="Markdown metnine ekle"
                              >
                                Metne Ekle
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteImageFromKnowHow(activeDoc.id, img.id)}
                                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                title="Görseli sil"
                                aria-label="Görseli sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Relations, Backlinks & Linked Todos Footer */}
              <div className="grid grid-cols-1 gap-6 border-t border-zinc-200 pt-6 lg:grid-cols-2 dark:border-zinc-800">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      <Link2 className="h-3.5 w-3.5" />
                      <span>İlişkili Know-How Kayıtları ({outgoingRelated.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRelatedPicker((s) => !s)}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 whitespace-nowrap"
                    >
                      <Plus className="h-3 w-3" />
                      <span>İlişkili Kayıt Ekle</span>
                    </button>
                  </div>

                  {showRelatedPicker && (
                    <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <input
                        type="text"
                        value={relatedSearch}
                        onChange={(e) => setRelatedSearch(e.target.value)}
                        placeholder="Bağlanacak Know-How kaydını ara..."
                        className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <div className="max-h-36 overflow-y-auto divide-y divide-zinc-200/70 dark:divide-zinc-800">
                        {availableRelatedToAdd.length === 0 ? (
                          <div className="py-2 text-center text-xs text-zinc-400">
                            Eklenebilecek başka kayıt bulunamadı.
                          </div>
                        ) : (
                          availableRelatedToAdd.map((candidate) => (
                            <button
                              key={candidate.id}
                              type="button"
                              onClick={() => {
                                updateActiveDoc({
                                  relatedKnowHowIds: [
                                    ...activeDoc.relatedKnowHowIds,
                                    candidate.id,
                                  ],
                                });
                                setRelatedSearch('');
                              }}
                              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-white dark:hover:bg-zinc-800"
                            >
                              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                                {candidate.title}
                              </span>
                              <span className="shrink-0 text-blue-600 dark:text-blue-400">
                                + Bağla
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {outgoingRelated.length === 0 ? (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      Bu dokümana doğrudan bağlanan başka bir Know-How kaydı yok.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {outgoingRelated.map((rel) => {
                        const isExplicit = activeDoc.relatedKnowHowIds.includes(rel.id);
                        return (
                          <div
                            key={rel.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/40 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/30"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectKnowHow(rel.id)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium text-zinc-800 hover:text-blue-600 dark:text-zinc-200 dark:hover:text-blue-400"
                            >
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                              <span className="truncate">{rel.title}</span>
                            </button>
                            {isExplicit && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateActiveDoc({
                                    relatedKnowHowIds: activeDoc.relatedKnowHowIds.filter(
                                      (id) => id !== rel.id
                                    ),
                                  })
                                }
                                className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Bağlantıyı kaldır"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Backlinks & Linked Todos */}
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Geri Bağlantılar — Referans Verenler ({backlinkKnowHows.length})
                    </h3>
                    {backlinkKnowHows.length === 0 ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        Henüz başka bir Know-How bu kayda referans vermemiş.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {backlinkKnowHows.map((refDoc) => (
                          <button
                            key={refDoc.id}
                            type="button"
                            onClick={() => onSelectKnowHow(refDoc.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/40 px-3 py-2 text-left text-xs transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-blue-700"
                          >
                            <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                              {refDoc.title}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Bağlı Görevler ({linkedTodos.length})
                    </h3>
                    {linkedTodos.length === 0 ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        Bu Know-How henüz hiçbir göreve bağlanmamış.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {linkedTodos.map((todo) => (
                          <button
                            key={todo.id}
                            type="button"
                            onClick={() => onOpenTodo(todo.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/40 px-3 py-2 text-left transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-blue-700"
                          >
                            <div className="min-w-0">
                              <div
                                className={`truncate text-xs font-medium ${
                                  todo.completed
                                    ? 'text-zinc-400 line-through dark:text-zinc-500'
                                    : 'text-zinc-900 dark:text-zinc-100'
                                }`}
                              >
                                {todo.title}
                              </div>
                              <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {STATUS_LABELS[todo.status]} · {PRIORITY_LABELS[todo.priority]}
                              </div>
                            </div>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
