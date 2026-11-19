import React, {useMemo, useRef, useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BellRing,
  BookOpen,
  Bold,
  Check,
  CheckSquare,
  Clock,
  Code,
  Eye,
  List,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {KnowHowItem, TodoItem, TodoPriority, TodoStatus} from '../types';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  formatDeadline,
  formatDeadlineRelative,
  formatTurkishDate,
  fromDateTimeLocalValue,
  normalizeTag,
  toDateTimeLocalValue,
} from '../utils/labels';
import {MarkdownRenderer} from '../utils/markdown';

interface TodoViewProps {
  todos: TodoItem[];
  knowhows: KnowHowItem[];
  now: number;
  selectedTodoId: string | null;
  onSelectTodo: (id: string | null) => void;
  onCreateTodo: (input: {
    title: string;
    priority: TodoPriority;
    tags: string[];
    deadline: number | null;
    hourlyReminder: boolean;
  }) => Promise<void>;
  onUpdateTodo: (todo: TodoItem) => Promise<void>;
  onDeleteTodo: (id: string) => Promise<void>;
  onPreviewKnowHow: (id: string) => void;
  onOpenKnowHowModule: (id: string) => void;
  searchQuery: string;
  activeTagFilter: string | null;
  onTagFilterChange: (tag: string | null) => void;
  quickInputRef?: React.RefObject<HTMLInputElement | null>;
}

type StatusFilter = 'all' | 'active' | TodoStatus;
type DeadlineFilter = 'all' | 'with_deadline' | 'overdue' | 'hourly';
type QuickDeadlinePreset = 'none' | '1h' | '2h' | '4h' | 'today18' | 'tomorrow09';

function resolveDeadlinePreset(preset: QuickDeadlinePreset): number | null {
  const now = Date.now();
  if (preset === 'none') return null;
  if (preset === '1h') return now + 60 * 60 * 1000;
  if (preset === '2h') return now + 2 * 60 * 60 * 1000;
  if (preset === '4h') return now + 4 * 60 * 60 * 1000;
  if (preset === 'today18') {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

function PriorityIndicator({priority}: {priority: TodoPriority}) {
  if (priority === TodoPriority.HIGH) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
        <ArrowUp className="h-3.5 w-3.5 shrink-0" />
        <span>{PRIORITY_LABELS[priority]}</span>
      </span>
    );
  }
  if (priority === TodoPriority.MEDIUM) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
        <Minus className="h-3.5 w-3.5 shrink-0" />
        <span>{PRIORITY_LABELS[priority]}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
      <ArrowDown className="h-3.5 w-3.5 shrink-0" />
      <span>{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

export const TodoView: React.FC<TodoViewProps> = ({
  todos,
  knowhows,
  now,
  selectedTodoId,
  onSelectTodo,
  onCreateTodo,
  onUpdateTodo,
  onDeleteTodo,
  onPreviewKnowHow,
  onOpenKnowHowModule,
  searchQuery,
  activeTagFilter,
  onTagFilterChange,
  quickInputRef,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>(TodoPriority.MEDIUM);
  const [newTagsRaw, setNewTagsRaw] = useState('');
  const [newDeadlinePreset, setNewDeadlinePreset] = useState<QuickDeadlinePreset>('none');
  const [newHourlyReminder, setNewHourlyReminder] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TodoPriority>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');

  // Detail panel state
  const [notesMode, setNotesMode] = useState<'edit' | 'preview'>('edit');
  const [tagDraft, setTagDraft] = useState('');
  const [knowHowQuery, setKnowHowQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedTodo = useMemo(
    () => todos.find((t) => t.id === selectedTodoId) ?? null,
    [todos, selectedTodoId]
  );

  const filteredTodos = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return todos.filter((todo) => {
      if (statusFilter === 'active' && todo.completed) return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'active' &&
        todo.status !== statusFilter
      ) {
        return false;
      }
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) {
        return false;
      }
      if (deadlineFilter === 'with_deadline' && !todo.deadline) return false;
      if (
        deadlineFilter === 'overdue' &&
        (todo.completed || !todo.deadline || todo.deadline >= now)
      ) {
        return false;
      }
      if (deadlineFilter === 'hourly' && !todo.hourlyReminder) return false;

      if (activeTagFilter && !todo.tags.includes(activeTagFilter)) {
        return false;
      }
      if (q) {
        const haystack = `${todo.title} ${todo.notes} ${todo.tags.join(' ')}`.toLocaleLowerCase('tr-TR');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [todos, statusFilter, priorityFilter, deadlineFilter, activeTagFilter, searchQuery, now]);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const parsedTags = newTagsRaw
      .split(',')
      .map(normalizeTag)
      .filter(Boolean);

    await onCreateTodo({
      title: trimmed,
      priority: newPriority,
      tags: Array.from(new Set(parsedTags)),
      deadline: resolveDeadlinePreset(newDeadlinePreset),
      hourlyReminder: newHourlyReminder,
    });
    setNewTitle('');
    setNewTagsRaw('');
    setNewDeadlinePreset('none');
    setNewHourlyReminder(false);
  };

  const toggleTodoComplete = async (todo: TodoItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextCompleted = !todo.completed;
    await onUpdateTodo({
      ...todo,
      completed: nextCompleted,
      status: nextCompleted ? TodoStatus.DONE : TodoStatus.TODO,
      updatedAt: Date.now(),
    });
  };

  const updateSelectedField = async (patch: Partial<TodoItem>) => {
    if (!selectedTodo) return;
    const nextStatus = patch.status ?? selectedTodo.status;
    const nextCompleted =
      patch.completed !== undefined
        ? patch.completed
        : patch.status !== undefined
        ? nextStatus === TodoStatus.DONE
        : selectedTodo.completed;

    await onUpdateTodo({
      ...selectedTodo,
      ...patch,
      status: nextStatus,
      completed: nextCompleted,
      updatedAt: Date.now(),
    });
  };

  const applyDetailQuickDeadline = async (hoursToAdd: number | 'today18' | 'clear') => {
    if (!selectedTodo) return;
    if (hoursToAdd === 'clear') {
      await updateSelectedField({deadline: null});
      return;
    }
    if (hoursToAdd === 'today18') {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      await updateSelectedField({deadline: d.getTime()});
      return;
    }
    const base = selectedTodo.deadline && selectedTodo.deadline > Date.now()
      ? selectedTodo.deadline
      : Date.now();
    await updateSelectedField({deadline: base + hoursToAdd * 60 * 60 * 1000});
  };

  const handleAddTagToSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTodo) return;
    const cleaned = normalizeTag(tagDraft);
    if (!cleaned) return;
    if (!selectedTodo.tags.includes(cleaned)) {
      await updateSelectedField({tags: [...selectedTodo.tags, cleaned]});
    }
    setTagDraft('');
  };

  const handleRemoveTagFromSelected = async (tagToRemove: string) => {
    if (!selectedTodo) return;
    await updateSelectedField({
      tags: selectedTodo.tags.filter((t) => t !== tagToRemove),
    });
  };

  const insertMarkdownSnippet = (snippet: string) => {
    if (!selectedTodo) return;
    const el = notesTextareaRef.current;
    if (!el) {
      updateSelectedField({notes: `${selectedTodo.notes}${selectedTodo.notes ? '\n' : ''}${snippet}`});
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = selectedTodo.notes.slice(0, start);
    const after = selectedTodo.notes.slice(end);
    const nextNotes = `${before}${snippet}${after}`;
    updateSelectedField({notes: nextNotes});
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleToggleNoteTaskLine = async (lineIndex: number, nextChecked: boolean) => {
    if (!selectedTodo) return;
    const lines = selectedTodo.notes.split('\n');
    if (!lines[lineIndex]) return;
    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*[-*]\s+)\[( |x|X)\]/,
      `$1[${nextChecked ? 'x' : ' '}]`
    );
    await updateSelectedField({notes: lines.join('\n')});
  };

  // Searchable Know-Hows for linking
  const availableKnowHowsToLink = useMemo(() => {
    if (!selectedTodo) return [];
    const q = knowHowQuery.trim().toLocaleLowerCase('tr-TR');
    return knowhows.filter((kh) => {
      if (selectedTodo.linkedKnowHowIds.includes(kh.id)) return false;
      if (!q) return true;
      return (
        kh.title.toLocaleLowerCase('tr-TR').includes(q) ||
        kh.tags.some((t) => t.toLocaleLowerCase('tr-TR').includes(q))
      );
    });
  }, [knowhows, selectedTodo, knowHowQuery]);

  const linkedKnowHows = useMemo(() => {
    if (!selectedTodo) return [];
    return selectedTodo.linkedKnowHowIds
      .map((id) => knowhows.find((k) => k.id === id))
      .filter((k): k is KnowHowItem => Boolean(k));
  }, [knowhows, selectedTodo]);

  const statusTabs: {id: StatusFilter; label: string}[] = [
    {id: 'all', label: 'Tümü'},
    {id: 'active', label: 'Aktif'},
    {id: TodoStatus.TODO, label: 'Yapılacak'},
    {id: TodoStatus.IN_PROGRESS, label: 'Devam Ediyor'},
    {id: TodoStatus.DONE, label: 'Tamamlandı'},
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* Main list column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Quick Add Bar */}
        <form
          onSubmit={handleQuickSubmit}
          className="border-b border-zinc-200 bg-white px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                ref={quickInputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Hızlı görev ekle... (Örn: Nginx yapılandırmasını güncelle)"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-500 dark:focus:bg-zinc-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                type="text"
                value={newTagsRaw}
                onChange={(e) => setNewTagsRaw(e.target.value)}
                placeholder="Etiketler (virgülle)"
                className="w-32 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-500"
              />

              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
                aria-label="Görev önceliği"
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-medium text-zinc-700 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value={TodoPriority.LOW}>Düşük Öncelik</option>
                <option value={TodoPriority.MEDIUM}>Orta Öncelik</option>
                <option value={TodoPriority.HIGH}>Yüksek Öncelik</option>
              </select>

              <select
                value={newDeadlinePreset}
                onChange={(e) =>
                  setNewDeadlinePreset(e.target.value as QuickDeadlinePreset)
                }
                aria-label="Hızlı son tarih seçimi"
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-medium text-zinc-700 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="none">Son Tarih Yok</option>
                <option value="1h">+1 Saat (Deadline)</option>
                <option value="2h">+2 Saat (Deadline)</option>
                <option value="4h">+4 Saat (Deadline)</option>
                <option value="today18">Bugün 18:00</option>
                <option value="tomorrow09">Yarın 09:00</option>
              </select>

              <button
                type="button"
                onClick={() => setNewHourlyReminder((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  newHourlyReminder
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900'
                }`}
                title="Her saat başı hatırlatma bildirimi göster"
              >
                <BellRing className="h-3.5 w-3.5 shrink-0" />
                <span>Saatlik</span>
              </button>

              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                Görev Ekle
              </button>
            </div>
          </div>
        </form>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-6 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-200/70 p-0.5 dark:bg-zinc-900">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTagFilter && (
              <button
                type="button"
                onClick={() => onTagFilterChange(null)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 whitespace-nowrap"
              >
                <span>Etiket: #{activeTagFilter}</span>
                <X className="h-3 w-3" />
              </button>
            )}

            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
              aria-label="Son tarih filtresi"
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="all">Tüm Zamanlar</option>
              <option value="with_deadline">Son Tarihli</option>
              <option value="overdue">Gecikmişler</option>
              <option value="hourly">Saatlik Hatırlatmalı</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'all' | TodoPriority)}
              aria-label="Öncelik filtresi"
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="all">Tüm Öncelikler</option>
              <option value={TodoPriority.HIGH}>Sadece Yüksek</option>
              <option value={TodoPriority.MEDIUM}>Sadece Orta</option>
              <option value={TodoPriority.LOW}>Sadece Düşük</option>
            </select>
          </div>
        </div>

        {/* Todo rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
          {filteredTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <CheckSquare className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Görüntülenecek görev bulunamadı
              </p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                Yukarıdaki hızlı ekleme alanından yeni bir görev oluşturabilir veya filtreleri temizleyebilirsiniz.
              </p>
              {(statusFilter !== 'all' ||
                priorityFilter !== 'all' ||
                deadlineFilter !== 'all' ||
                activeTagFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setDeadlineFilter('all');
                    onTagFilterChange(null);
                  }}
                  className="mt-4 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  Filtreleri Sıfırla
                </button>
              )}
            </div>
          ) : (
            filteredTodos.map((todo) => {
              const isSelected = todo.id === selectedTodoId;
              const linkedCount = todo.linkedKnowHowIds.filter((id) =>
                knowhows.some((k) => k.id === id)
              ).length;

              const hasDeadline = typeof todo.deadline === 'number' && todo.deadline !== null;
              const isOverdue = hasDeadline && !todo.completed && todo.deadline! < now;
              const isSoon =
                hasDeadline &&
                !todo.completed &&
                !isOverdue &&
                todo.deadline! - now <= 3 * 60 * 60 * 1000;

              return (
                <div
                  key={todo.id}
                  onClick={() => {
                    onSelectTodo(todo.id);
                    setConfirmDeleteId(null);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectTodo(todo.id);
                    }
                  }}
                  className={`group flex cursor-pointer items-start gap-3 px-6 py-3.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/25'
                      : 'bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleTodoComplete(todo, e)}
                    aria-label={todo.completed ? 'Görevi aktif yap' : 'Görevi tamamla'}
                    className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                      todo.completed
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-zinc-300 bg-white hover:border-blue-600 dark:border-zinc-600 dark:bg-zinc-900'
                    }`}
                  >
                    {todo.completed && <Check className="h-3 w-3 stroke-[2.5]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={`truncate text-sm font-medium ${
                          todo.completed
                            ? 'text-zinc-400 line-through dark:text-zinc-500'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {todo.title}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500">
                        {formatTurkishDate(todo.updatedAt)}
                      </span>
                    </div>

                    {/* Clean unboxed metadata line */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <PriorityIndicator priority={todo.priority} />
                      <span aria-hidden="true">·</span>
                      <span>{STATUS_LABELS[todo.status]}</span>

                      {hasDeadline && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`inline-flex items-center gap-1 font-mono tabular-nums whitespace-nowrap ${
                              isOverdue
                                ? 'font-medium text-red-600 dark:text-red-400'
                                : isSoon
                                ? 'font-medium text-amber-600 dark:text-amber-400'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>
                              {formatDeadline(todo.deadline!)} ({formatDeadlineRelative(todo.deadline!, now)})
                            </span>
                          </span>
                        </>
                      )}

                      {todo.hourlyReminder && !todo.completed && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            <BellRing className="h-3 w-3 shrink-0" />
                            <span>Saatlik hatırlatma</span>
                          </span>
                        </>
                      )}

                      {linkedCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 tabular-nums">
                            <BookOpen className="h-3 w-3" />
                            <span>{linkedCount} Know-How</span>
                          </span>
                        </>
                      )}

                      {todo.tags.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            {todo.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTagFilterChange(activeTagFilter === tag ? null : tag);
                                }}
                                className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-200"
                              >
                                #{tag}
                              </button>
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail Panel */}
      {selectedTodo && (
        <aside
          className="fixed inset-y-0 right-0 z-30 flex w-full max-w-lg flex-col border-l border-zinc-200 bg-white shadow-xl lg:static lg:z-0 lg:w-[440px] lg:shadow-none xl:w-[480px] dark:border-zinc-800 dark:bg-zinc-950"
          aria-label="Görev Detayı"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleTodoComplete(selectedTodo)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedTodo.completed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>{selectedTodo.completed ? 'Tamamlandı' : 'Tamamla'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {confirmDeleteId === selectedTodo.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteTodo(selectedTodo.id);
                      setConfirmDeleteId(null);
                    }}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    Evet, Sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedTodo.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  title="Görevi sil"
                  aria-label="Görevi sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectTodo(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Detay panelini kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Title */}
            <div>
              <input
                type="text"
                value={selectedTodo.title}
                onChange={(e) => updateSelectedField({title: e.target.value})}
                placeholder="Görev başlığı..."
                className="w-full border-0 bg-transparent p-0 text-base font-semibold text-zinc-950 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50"
              />
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div>
                <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                  Durum
                </label>
                <select
                  value={selectedTodo.status}
                  onChange={(e) =>
                    updateSelectedField({status: e.target.value as TodoStatus})
                  }
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value={TodoStatus.TODO}>Yapılacak</option>
                  <option value={TodoStatus.IN_PROGRESS}>Devam Ediyor</option>
                  <option value={TodoStatus.DONE}>Tamamlandı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                  Öncelik
                </label>
                <select
                  value={selectedTodo.priority}
                  onChange={(e) =>
                    updateSelectedField({priority: e.target.value as TodoPriority})
                  }
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value={TodoPriority.LOW}>Düşük</option>
                  <option value={TodoPriority.MEDIUM}>Orta</option>
                  <option value={TodoPriority.HIGH}>Yüksek</option>
                </select>
              </div>
            </div>

            {/* Deadline (Date + Hour) & Hourly Reminder */}
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="todo-deadline-input"
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                >
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Son Tarih &amp; Saat (Deadline)</span>
                </label>

                {selectedTodo.deadline && (
                  <button
                    type="button"
                    onClick={() => applyDetailQuickDeadline('clear')}
                    className="text-[11px] font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                  >
                    Temizle
                  </button>
                )}
              </div>

              <input
                id="todo-deadline-input"
                type="datetime-local"
                value={toDateTimeLocalValue(selectedTodo.deadline)}
                onChange={(e) =>
                  updateSelectedField({
                    deadline: fromDateTimeLocalValue(e.target.value),
                  })
                }
                className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />

              {/* Quick hourly deadline buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDetailQuickDeadline(1)}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  +1 Saat
                </button>
                <button
                  type="button"
                  onClick={() => applyDetailQuickDeadline(2)}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  +2 Saat
                </button>
                <button
                  type="button"
                  onClick={() => applyDetailQuickDeadline(4)}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  +4 Saat
                </button>
                <button
                  type="button"
                  onClick={() => applyDetailQuickDeadline('today18')}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Bugün 18:00
                </button>
              </div>

              {selectedTodo.deadline && (
                <div
                  className={`font-mono text-[11px] tabular-nums ${
                    !selectedTodo.completed && selectedTodo.deadline < now
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {formatDeadline(selectedTodo.deadline)} ·{' '}
                  {formatDeadlineRelative(selectedTodo.deadline, now)}
                </div>
              )}

              {/* Hourly reminder toggle */}
              <label className="flex cursor-pointer items-start gap-2.5 border-t border-zinc-200/80 pt-2.5 dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTodo.hourlyReminder)}
                  onChange={(e) =>
                    updateSelectedField({hourlyReminder: e.target.checked})
                  }
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <div className="text-xs">
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    Saatlik hatırlatma göster
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Görev tamamlanana kadar saatlik periyotlarla ve açılışta hatırlatma bildirimi sunar.
                  </div>
                </div>
              </label>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Etiketler
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {selectedTodo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTagFromSelected(tag)}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                      aria-label={`${tag} etiketini kaldır`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <form onSubmit={handleAddTagToSelected} className="inline-flex items-center">
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    placeholder="+ Etiket ekle"
                    className="w-28 rounded-md border border-dashed border-zinc-300 bg-transparent px-2 py-0.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:text-zinc-200"
                  />
                </form>
              </div>
            </div>

            {/* Free-form Markdown Notes */}
            <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Notlar (Markdown)
                </span>
                <div className="flex items-center gap-1 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setNotesMode('edit')}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      notesMode === 'edit'
                        ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Düzenle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesMode('preview')}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      notesMode === 'preview'
                        ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>Önizleme</span>
                  </button>
                </div>
              </div>

              {notesMode === 'edit' ? (
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white focus-within:border-blue-600 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50/70 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet('**kalın**')}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      title="Kalın metin"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet('\n- Liste maddesi')}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      title="Liste"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet('\n- [ ] Yapılacak adım')}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      title="Kontrol listesi"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet('`kod`')}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      title="Satır içi kod"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    ref={notesTextareaRef}
                    rows={6}
                    value={selectedTodo.notes}
                    onChange={(e) => updateSelectedField({notes: e.target.value})}
                    placeholder="Görevle ilgili notlar, kontrol listeleri veya komutlar..."
                    className="w-full resize-y bg-transparent p-3 text-sm leading-relaxed text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-200 dark:placeholder:text-zinc-500"
                  />
                </div>
              ) : (
                <div className="min-h-[140px] rounded-lg border border-zinc-200 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/30">
                  <MarkdownRenderer
                    content={selectedTodo.notes}
                    knowHowTitles={knowhows.map((k) => k.title)}
                    onWikiLinkClick={(title) => {
                      const target = knowhows.find(
                        (k) => k.title.trim().toLowerCase() === title.trim().toLowerCase()
                      );
                      if (target) onPreviewKnowHow(target.id);
                    }}
                    onToggleTaskLine={handleToggleNoteTaskLine}
                    emptyText="Bu görev için henüz not eklenmemiş."
                  />
                </div>
              )}
            </div>

            {/* Linked Know-Hows Section */}
            <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Bağlı Know-How&apos;lar ({linkedKnowHows.length})
                </h3>
              </div>

              {linkedKnowHows.length > 0 ? (
                <div className="mb-3 space-y-2">
                  {linkedKnowHows.map((kh) => (
                    <div
                      key={kh.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-700"
                    >
                      <button
                        type="button"
                        onClick={() => onPreviewKnowHow(kh.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <BookOpen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {kh.title}
                          </div>
                          {(kh.category || kh.tags.length > 0) && (
                            <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              {[kh.category, ...kh.tags.map((t) => `#${t}`)]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenKnowHowModule(kh.id)}
                          className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          title="Know-How modülünde aç"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedField({
                              linkedKnowHowIds: selectedTodo.linkedKnowHowIds.filter(
                                (id) => id !== kh.id
                              ),
                            })
                          }
                          className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="Bağlantıyı kaldır"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
                  Henüz bağlı Know-How yok. Aşağıdan arayarak bağlayabilirsiniz.
                </p>
              )}

              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={knowHowQuery}
                    onChange={(e) => setKnowHowQuery(e.target.value)}
                    placeholder="Know-How ara ve bu göreve bağla..."
                    className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {(knowHowQuery.trim() !== '' || availableKnowHowsToLink.length > 0) && (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:divide-zinc-800">
                    {availableKnowHowsToLink.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">
                        Eşleşen Know-How bulunamadı.
                      </div>
                    ) : (
                      availableKnowHowsToLink.map((kh) => (
                        <button
                          key={kh.id}
                          type="button"
                          onClick={() => {
                            updateSelectedField({
                              linkedKnowHowIds: [...selectedTodo.linkedKnowHowIds, kh.id],
                            });
                            setKnowHowQuery('');
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                            {kh.title}
                          </span>
                          <span className="shrink-0 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            + Bağla
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
