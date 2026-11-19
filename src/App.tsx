import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AlertCircle, Bell, Menu, Plus, Search, X} from 'lucide-react';
import {
  KnowHowItem,
  NavigationTab,
  StoredImage,
  TodoItem,
  TodoPriority,
  TodoStatus,
} from './types';
import {
  generateId,
  initializeAndLoadWorkspace,
  removeImage,
  removeKnowHow,
  removeTodo,
  saveFolders,
  saveImage,
  saveKnowHow,
  saveTodo,
} from './db/indexedDb';
import {optimizeImageFile} from './utils/imageOptimizer';
import {formatDeadline, normalizeCategory} from './utils/labels';
import {Sidebar} from './components/Sidebar';
import {TodoView} from './components/TodoView';
import {KnowHowView} from './components/KnowHowView';
import {SearchTagsView} from './components/SearchTagsView';
import {KnowHowPreviewModal} from './components/KnowHowPreviewModal';
import {Lightbox} from './components/Lightbox';
import {BackupModal} from './components/BackupModal';
import {ReminderCenter, buildReminderSummary} from './components/ReminderCenter';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [knowhows, setKnowhows] = useState<KnowHowItem[]>([]);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [folders, setFolders] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.TODOS);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [selectedKnowHowId, setSelectedKnowHowId] = useState<string | null>(null);

  const [globalSearch, setGlobalSearch] = useState('');
  const [todoTagFilter, setTodoTagFilter] = useState<string | null>(null);

  const [previewKnowHowId, setPreviewKnowHowId] = useState<string | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    activeId: string;
    scope: StoredImage[];
  } | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Reminder & live clock state
  const [now, setNow] = useState<number>(() => Date.now());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderReason, setReminderReason] = useState<
    'startup' | 'hourly' | 'deadline' | 'manual'
  >('startup');
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const lastHourlyReminderRef = useRef<number>(Date.now());
  const notifiedDeadlinesRef = useRef<Set<string>>(new Set());

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickTodoInputRef = useRef<HTMLInputElement>(null);
  const imageUrlsRef = useRef<Record<string, string>>({});

  // Keep ObjectURLs synchronized with stored images
  const imageUrls = useMemo(() => {
    const nextUrls: Record<string, string> = {};
    const validIds = new Set(images.map((i) => i.id));

    for (const [id, url] of Object.entries(imageUrlsRef.current)) {
      if (!validIds.has(id)) {
        URL.revokeObjectURL(url);
      } else {
        nextUrls[id] = url;
      }
    }

    for (const img of images) {
      if (!nextUrls[img.id] && img.blob) {
        nextUrls[img.id] = URL.createObjectURL(img.blob);
      }
    }

    imageUrlsRef.current = nextUrls;
    return nextUrls;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(imageUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const sendBrowserNotification = useCallback(
    (title: string, body: string) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted'
      ) {
        return;
      }
      try {
        new Notification(title, {body});
      } catch {
        // ignore in restricted environments
      }
    },
    []
  );

  // Load workspace from IndexedDB on mount and show automatic startup reminder
  useEffect(() => {
    let mounted = true;
    initializeAndLoadWorkspace()
      .then((data) => {
        if (!mounted) return;
        setTodos(data.todos);
        setKnowhows(data.knowhows);
        setImages(data.images);
        setFolders(data.folders);
        if (data.knowhows.length > 0) {
          setSelectedKnowHowId(data.knowhows[0].id);
        }
        setLoading(false);

        // Always show automatic reminder notification when application opens
        const bootNow = Date.now();
        setNow(bootNow);
        setReminderReason('startup');
        setReminderOpen(true);

        // Record already-passed deadlines on boot so they don't immediately re-fire 30s later
        for (const t of data.todos) {
          if (!t.completed && t.deadline && t.deadline <= bootNow) {
            notifiedDeadlinesRef.current.add(`${t.id}_${t.deadline}`);
          }
        }
        lastHourlyReminderRef.current = bootNow;
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Yerel IndexedDB veritabanı yüklenirken hata oluştu.'
        );
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Periodic 30-second timer for live deadline & hourly reminder checks
  useEffect(() => {
    const interval = window.setInterval(() => {
      const tickNow = Date.now();
      setNow(tickNow);

      if (loading || tickNow < snoozedUntil) return;

      const activeTodos = todos.filter((t) => !t.completed);

      // 1. Check newly reached deadlines
      const newlyDue = activeTodos.filter((t) => {
        if (!t.deadline) return false;
        const key = `${t.id}_${t.deadline}`;
        return t.deadline <= tickNow && !notifiedDeadlinesRef.current.has(key);
      });

      if (newlyDue.length > 0) {
        for (const t of newlyDue) {
          notifiedDeadlinesRef.current.add(`${t.id}_${t.deadline}`);
        }
        setReminderReason('deadline');
        setReminderOpen(true);
        sendBrowserNotification(
          'Son Tarih Hatırlatması',
          newlyDue.map((t) => `${t.title} (${formatDeadline(t.deadline!)})`).join(', ')
        );
        return;
      }

      // 2. Check hourly reminders every 60 minutes
      const hourlyTasks = activeTodos.filter((t) => Boolean(t.hourlyReminder));
      if (
        hourlyTasks.length > 0 &&
        tickNow - lastHourlyReminderRef.current >= 60 * 60 * 1000
      ) {
        lastHourlyReminderRef.current = tickNow;
        setReminderReason('hourly');
        setReminderOpen(true);
        sendBrowserNotification(
          'Saatlik Görev Hatırlatması',
          `${hourlyTasks.length} görev için saatlik hatırlatma: ${hourlyTasks[0].title}`
        );
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [loading, snoozedUntil, todos, sendBrowserNotification]);

  // Global keyboard shortcut (Ctrl+K / Cmd+K) for search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('dizin_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('dizin_theme', 'light');
      }
      return next;
    });
  }, []);

  const handleRequestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
    } catch {
      // ignore
    }
  };

  const handleCreateTodo = async (input: {
    title: string;
    priority: TodoPriority;
    tags: string[];
    deadline: number | null;
    hourlyReminder: boolean;
  }) => {
    const createdAt = Date.now();
    const newTodo: TodoItem = {
      id: generateId('todo'),
      title: input.title,
      completed: false,
      status: TodoStatus.TODO,
      priority: input.priority,
      tags: input.tags,
      notes: '',
      linkedKnowHowIds: [],
      deadline: input.deadline,
      hourlyReminder: input.hourlyReminder,
      createdAt,
      updatedAt: createdAt,
    };
    setTodos((prev) => [newTodo, ...prev]);
    setSelectedTodoId(newTodo.id);
    await saveTodo(newTodo);
  };

  const handleUpdateTodo = async (updated: TodoItem) => {
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await saveTodo(updated);
  };

  const handleDeleteTodo = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (selectedTodoId === id) setSelectedTodoId(null);
    await removeTodo(id);
  };

  const handleCreateFolder = async (name: string) => {
    const cleaned = normalizeCategory(name);
    if (!cleaned) return;
    const next = Array.from(new Set([...folders, cleaned])).sort((a, b) =>
      a.localeCompare(b, 'tr-TR')
    );
    setFolders(next);
    await saveFolders(next);
  };

  const handleDeleteFolder = async (name: string) => {
    const next = folders.filter((f) => f !== name);
    setFolders(next);
    await saveFolders(next);
  };

  const handleCreateKnowHow = async (initialCategory?: string): Promise<KnowHowItem> => {
    const createdAt = Date.now();
    const cleanedCat = normalizeCategory(initialCategory);
    const doc: KnowHowItem = {
      id: generateId('kh'),
      title: 'Yeni Know-How Kaydı',
      category: cleanedCat || undefined,
      content: '',
      tags: [],
      relatedKnowHowIds: [],
      imageIds: [],
      createdAt,
      updatedAt: createdAt,
    };
    setKnowhows((prev) => [doc, ...prev]);
    setSelectedKnowHowId(doc.id);
    await saveKnowHow(doc);
    return doc;
  };

  const handleUpdateKnowHow = async (updated: KnowHowItem) => {
    setKnowhows((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
    const cat = normalizeCategory(updated.category);
    if (cat && !folders.includes(cat)) {
      const nextFolders = [...folders, cat].sort((a, b) => a.localeCompare(b, 'tr-TR'));
      setFolders(nextFolders);
      await saveFolders(nextFolders);
    }
    await saveKnowHow(updated);
  };

  const handleDeleteKnowHow = async (id: string) => {
    const target = knowhows.find((k) => k.id === id);
    setKnowhows((prev) =>
      prev
        .filter((k) => k.id !== id)
        .map((k) =>
          k.relatedKnowHowIds.includes(id)
            ? {
                ...k,
                relatedKnowHowIds: k.relatedKnowHowIds.filter((rid) => rid !== id),
              }
            : k
        )
    );

    const affectedTodos = todos.filter((t) => t.linkedKnowHowIds.includes(id));
    if (affectedTodos.length > 0) {
      setTodos((prev) =>
        prev.map((t) =>
          t.linkedKnowHowIds.includes(id)
            ? {
                ...t,
                linkedKnowHowIds: t.linkedKnowHowIds.filter((kid) => kid !== id),
              }
            : t
        )
      );
      await Promise.all(
        affectedTodos.map((t) =>
          saveTodo({
            ...t,
            linkedKnowHowIds: t.linkedKnowHowIds.filter((kid) => kid !== id),
          })
        )
      );
    }

    if (selectedKnowHowId === id) {
      const remaining = knowhows.filter((k) => k.id !== id);
      setSelectedKnowHowId(remaining[0]?.id ?? null);
    }

    await removeKnowHow(id);

    if (target && target.imageIds.length > 0) {
      for (const imgId of target.imageIds) {
        setImages((prev) => prev.filter((img) => img.id !== imgId));
        await removeImage(imgId);
      }
    }
  };

  const handleUploadImagesToKnowHow = async (
    knowHowId: string,
    files: File[]
  ): Promise<StoredImage[]> => {
    const savedList: StoredImage[] = [];
    for (const file of files) {
      try {
        const optimized = await optimizeImageFile(file);
        const stored: StoredImage = {
          id: generateId('img'),
          name: optimized.name,
          mimeType: optimized.mimeType,
          width: optimized.width,
          height: optimized.height,
          size: optimized.size,
          blob: optimized.blob,
          createdAt: Date.now(),
        };
        await saveImage(stored);
        savedList.push(stored);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Görsel işlenirken bir hata oluştu.'
        );
      }
    }

    if (savedList.length > 0) {
      setImages((prev) => [...prev, ...savedList]);
      const newIds = savedList.map((s) => s.id);
      setKnowhows((prev) =>
        prev.map((k) => {
          if (k.id !== knowHowId) return k;
          const updated = {
            ...k,
            imageIds: [...k.imageIds, ...newIds],
            updatedAt: Date.now(),
          };
          saveKnowHow(updated);
          return updated;
        })
      );
    }

    return savedList;
  };

  const handleDeleteImageFromKnowHow = async (knowHowId: string, imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setKnowhows((prev) =>
      prev.map((k) => {
        if (k.id !== knowHowId) return k;
        const updated = {
          ...k,
          imageIds: k.imageIds.filter((id) => id !== imageId),
          updatedAt: Date.now(),
        };
        saveKnowHow(updated);
        return updated;
      })
    );
    await removeImage(imageId);
  };

  const activeTodoCount = useMemo(
    () => todos.filter((t) => !t.completed).length,
    [todos]
  );

  const reminderSummary = useMemo(
    () => buildReminderSummary(todos, now),
    [todos, now]
  );

  const previewKnowHow = useMemo(
    () => knowhows.find((k) => k.id === previewKnowHowId) ?? null,
    [knowhows, previewKnowHowId]
  );

  const sectionTitle =
    activeTab === NavigationTab.TODOS
      ? 'Görevler (Todo)'
      : activeTab === NavigationTab.KNOW_HOW
      ? 'Know-How Bilgi Bankası'
      : 'Arama ve Etiketler';

  const handlePrimaryHeaderAction = async () => {
    if (activeTab === NavigationTab.KNOW_HOW) {
      const created = await handleCreateKnowHow();
      setSelectedKnowHowId(created.id);
    } else {
      setActiveTab(NavigationTab.TODOS);
      requestAnimationFrame(() => {
        quickTodoInputRef.current?.focus();
      });
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeTodoCount={activeTodoCount}
        knowHowCount={knowhows.length}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenBackup={() => setBackupOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 lg:hidden dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              aria-label="Menüyü aç"
            >
              <Menu className="h-4 w-4" />
            </button>

            <h1 className="truncate text-sm font-semibold text-zinc-950 sm:text-base dark:text-zinc-50 whitespace-nowrap">
              {sectionTitle}
            </h1>
          </div>

          {/* Simple Global Search Bar */}
          <div className="hidden max-w-sm flex-1 sm:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Hızlı ara... (Ctrl+K)"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-900"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Aramayı temizle"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Header Actions: Reminder Trigger + Primary CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setReminderReason('manual');
                setReminderOpen((v) => !v);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                reminderSummary.overdue.length > 0
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
              }`}
              title="Hatırlatıcıları görüntüle"
            >
              <Bell className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:inline">Hatırlatıcı</span>
              <span className="font-mono tabular-nums text-[11px]">
                {reminderSummary.urgentCount > 0
                  ? reminderSummary.urgentCount
                  : reminderSummary.totalActiveCount}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrimaryHeaderAction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                {activeTab === NavigationTab.KNOW_HOW ? 'Yeni Know-How' : 'Yeni Görev'}
              </span>
            </button>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-6 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-medium underline"
            >
              Kapat
            </button>
          </div>
        )}

        {/* Active View Content */}
        {loading ? (
          <div className="flex-1 p-6 space-y-3">
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ) : activeTab === NavigationTab.TODOS ? (
          <TodoView
            todos={todos}
            knowhows={knowhows}
            now={now}
            selectedTodoId={selectedTodoId}
            onSelectTodo={setSelectedTodoId}
            onCreateTodo={handleCreateTodo}
            onUpdateTodo={handleUpdateTodo}
            onDeleteTodo={handleDeleteTodo}
            onPreviewKnowHow={(id) => setPreviewKnowHowId(id)}
            onOpenKnowHowModule={(id) => {
              setSelectedKnowHowId(id);
              setActiveTab(NavigationTab.KNOW_HOW);
            }}
            searchQuery={globalSearch}
            activeTagFilter={todoTagFilter}
            onTagFilterChange={setTodoTagFilter}
            quickInputRef={quickTodoInputRef}
          />
        ) : activeTab === NavigationTab.KNOW_HOW ? (
          <KnowHowView
            knowhows={knowhows}
            todos={todos}
            images={images}
            imageUrls={imageUrls}
            folders={folders}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            selectedKnowHowId={selectedKnowHowId}
            onSelectKnowHow={setSelectedKnowHowId}
            onCreateKnowHow={handleCreateKnowHow}
            onUpdateKnowHow={handleUpdateKnowHow}
            onDeleteKnowHow={handleDeleteKnowHow}
            onUploadImagesToKnowHow={handleUploadImagesToKnowHow}
            onDeleteImageFromKnowHow={handleDeleteImageFromKnowHow}
            onOpenLightbox={(activeId, scope) =>
              setLightboxState({activeId, scope})
            }
            onOpenTodo={(todoId) => {
              setSelectedTodoId(todoId);
              setActiveTab(NavigationTab.TODOS);
            }}
            searchQuery={globalSearch}
          />
        ) : (
          <SearchTagsView
            todos={todos}
            knowhows={knowhows}
            searchQuery={globalSearch}
            onSearchQueryChange={setGlobalSearch}
            onOpenTodo={(todoId) => {
              setSelectedTodoId(todoId);
              setActiveTab(NavigationTab.TODOS);
            }}
            onOpenKnowHow={(khId) => {
              setSelectedKnowHowId(khId);
              setActiveTab(NavigationTab.KNOW_HOW);
            }}
          />
        )}
      </div>

      {/* Automatic Startup & Hourly Reminder Notification */}
      <ReminderCenter
        isOpen={!loading && reminderOpen}
        triggerReason={reminderReason}
        todos={todos}
        now={now}
        notificationPermission={notificationPermission}
        onRequestBrowserPermission={handleRequestBrowserNotifications}
        onSnoozeOneHour={() => {
          setSnoozedUntil(Date.now() + 60 * 60 * 1000);
          setReminderOpen(false);
        }}
        onClose={() => setReminderOpen(false)}
        onOpenTodo={(todoId) => {
          setSelectedTodoId(todoId);
          setActiveTab(NavigationTab.TODOS);
          setReminderOpen(false);
        }}
      />

      {/* In-context Know-How Preview Modal (from Todo) */}
      <KnowHowPreviewModal
        knowhow={previewKnowHow}
        allKnowHows={knowhows}
        images={images}
        imageUrls={imageUrls}
        onClose={() => setPreviewKnowHowId(null)}
        onOpenInKnowHowModule={(id) => {
          setPreviewKnowHowId(null);
          setSelectedKnowHowId(id);
          setActiveTab(NavigationTab.KNOW_HOW);
        }}
        onNavigatePreview={(title) => {
          const target = knowhows.find(
            (k) => k.title.trim().toLowerCase() === title.trim().toLowerCase()
          );
          if (target) setPreviewKnowHowId(target.id);
        }}
        onOpenLightbox={(activeId, scope) =>
          setLightboxState({activeId, scope})
        }
      />

      {/* Fullscreen Image Lightbox */}
      <Lightbox
        images={lightboxState?.scope ?? []}
        imageUrls={imageUrls}
        activeImageId={lightboxState?.activeId ?? null}
        onClose={() => setLightboxState(null)}
        onSelectImage={(id) =>
          setLightboxState((prev) => (prev ? {...prev, activeId: id} : null))
        }
      />

      {/* JSON Export / Import Modal */}
      <BackupModal
        isOpen={backupOpen}
        onClose={() => setBackupOpen(false)}
        todos={todos}
        knowhows={knowhows}
        images={images}
        onImported={(data) => {
          setTodos(data.todos);
          setKnowhows(data.knowhows);
          setImages(data.images);
          setFolders(data.folders);
          setSelectedTodoId(null);
          setSelectedKnowHowId(data.knowhows[0]?.id ?? null);
        }}
      />
    </div>
  );
}
