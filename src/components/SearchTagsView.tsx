import React, {useMemo, useState} from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Hash,
  Search,
  X,
} from 'lucide-react';
import {KnowHowItem, TodoItem} from '../types';
import {PRIORITY_LABELS, STATUS_LABELS, formatTurkishDate} from '../utils/labels';

interface SearchTagsViewProps {
  todos: TodoItem[];
  knowhows: KnowHowItem[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onOpenTodo: (todoId: string) => void;
  onOpenKnowHow: (knowHowId: string) => void;
}

export const SearchTagsView: React.FC<SearchTagsViewProps> = ({
  todos,
  knowhows,
  searchQuery,
  onSearchQueryChange,
  onOpenTodo,
  onOpenKnowHow,
}) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const tagStats = useMemo(() => {
    const map = new Map<string, {todoCount: number; knowHowCount: number}>();
    for (const todo of todos) {
      for (const tag of todo.tags) {
        const entry = map.get(tag) ?? {todoCount: 0, knowHowCount: 0};
        entry.todoCount += 1;
        map.set(tag, entry);
      }
    }
    for (const kh of knowhows) {
      for (const tag of kh.tags) {
        const entry = map.get(tag) ?? {todoCount: 0, knowHowCount: 0};
        entry.knowHowCount += 1;
        map.set(tag, entry);
      }
    }
    return Array.from(map.entries())
      .map(([tag, counts]) => ({
        tag,
        ...counts,
        total: counts.todoCount + counts.knowHowCount,
      }))
      .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag, 'tr-TR'));
  }, [todos, knowhows]);

  const matchingTodos = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return todos.filter((todo) => {
      if (selectedTag && !todo.tags.includes(selectedTag)) return false;
      if (!q) return true;
      const haystack = `${todo.title} ${todo.notes} ${todo.tags.join(' ')}`.toLocaleLowerCase('tr-TR');
      return haystack.includes(q);
    });
  }, [todos, searchQuery, selectedTag]);

  const matchingKnowHows = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return knowhows.filter((kh) => {
      if (selectedTag && !kh.tags.includes(selectedTag)) return false;
      if (!q) return true;
      const haystack = `${kh.title} ${kh.content} ${kh.tags.join(' ')}`.toLocaleLowerCase('tr-TR');
      return haystack.includes(q);
    });
  }, [knowhows, searchQuery, selectedTag]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Search Input Header */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Tüm görevlerde, notlarda, Know-How dokümanlarında ve etiketlerde ara..."
              className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                aria-label="Aramayı temizle"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {selectedTag && (
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span>Seçili etiket filtresi:</span>
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
              >
                <span>#{selectedTag}</span>
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Tag Directory */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Etiket Dizini ({tagStats.length})
            </h2>
            {selectedTag && (
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Tümünü Göster
              </button>
            )}
          </div>

          {tagStats.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Henüz hiç etiket eklenmemiş. Görevlere veya Know-How kayıtlarına etiket ekleyebilirsiniz.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagStats.map((item) => {
                const isActive = selectedTag === item.tag;
                return (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => setSelectedTag(isActive ? null : item.tag)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <Hash className={`h-3 w-3 ${isActive ? 'text-blue-100' : 'text-zinc-400'}`} />
                    <span>{item.tag}</span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isActive ? 'text-blue-100' : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {item.total}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Results Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Matching Todos */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Görevler ({matchingTodos.length})
            </h2>

            {matchingTodos.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-500">
                Eşleşen görev bulunamadı.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-200/80 dark:border-zinc-800 dark:bg-zinc-900/40 dark:divide-zinc-800">
                {matchingTodos.map((todo) => (
                  <button
                    key={todo.id}
                    type="button"
                    onClick={() => onOpenTodo(todo.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      {todo.completed ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`truncate text-sm font-medium ${
                            todo.completed
                              ? 'text-zinc-400 line-through dark:text-zinc-500'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {todo.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{STATUS_LABELS[todo.status]}</span>
                          <span aria-hidden="true">·</span>
                          <span>{PRIORITY_LABELS[todo.priority]}</span>
                          {todo.tags.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{todo.tags.map((t) => `#${t}`).join(' · ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Matching Know-Hows */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Know-How Kayıtları ({matchingKnowHows.length})
            </h2>

            {matchingKnowHows.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-500">
                Eşleşen Know-How kaydı bulunamadı.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-200/80 dark:border-zinc-800 dark:bg-zinc-900/40 dark:divide-zinc-800">
                {matchingKnowHows.map((kh) => (
                  <button
                    key={kh.id}
                    type="button"
                    onClick={() => onOpenKnowHow(kh.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {kh.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-mono tabular-nums">
                            {formatTurkishDate(kh.updatedAt)}
                          </span>
                          {kh.tags.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{kh.tags.map((t) => `#${t}`).join(' · ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
