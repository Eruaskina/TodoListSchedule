import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
} from 'lucide-react';
import {TodoItem} from '../types';
import {
  PRIORITY_LABELS,
  formatDeadline,
  formatDeadlineRelative,
} from '../utils/labels';

export interface ReminderSummary {
  overdue: TodoItem[];
  upcomingSoon: TodoItem[];
  hourlyActive: TodoItem[];
  noDeadlineActive: TodoItem[];
  totalActiveCount: number;
  urgentCount: number;
}

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export function buildReminderSummary(todos: TodoItem[], now: number): ReminderSummary {
  const activeTodos = todos.filter((t) => !t.completed);

  const overdue = activeTodos
    .filter((t) => typeof t.deadline === 'number' && t.deadline !== null && t.deadline < now)
    .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0));

  const overdueIds = new Set(overdue.map((t) => t.id));

  const upcomingSoon = activeTodos
    .filter(
      (t) =>
        !overdueIds.has(t.id) &&
        typeof t.deadline === 'number' &&
        t.deadline !== null &&
        t.deadline >= now &&
        t.deadline <= now + THREE_HOURS_MS
    )
    .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0));

  const upcomingIds = new Set(upcomingSoon.map((t) => t.id));

  const hourlyActive = activeTodos.filter(
    (t) => Boolean(t.hourlyReminder) && !overdueIds.has(t.id) && !upcomingIds.has(t.id)
  );

  const noDeadlineActive = activeTodos.filter(
    (t) => (t.deadline === null || t.deadline === undefined) && !t.hourlyReminder
  );

  const urgentCount =
    overdue.length + upcomingSoon.length + hourlyActive.length;

  return {
    overdue,
    upcomingSoon,
    hourlyActive,
    noDeadlineActive,
    totalActiveCount: activeTodos.length,
    urgentCount,
  };
}

interface ReminderCenterProps {
  isOpen: boolean;
  triggerReason: 'startup' | 'hourly' | 'deadline' | 'manual';
  todos: TodoItem[];
  now: number;
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestBrowserPermission: () => void;
  onSnoozeOneHour: () => void;
  onClose: () => void;
  onOpenTodo: (todoId: string) => void;
}

export const ReminderCenter: React.FC<ReminderCenterProps> = ({
  isOpen,
  triggerReason,
  todos,
  now,
  notificationPermission,
  onRequestBrowserPermission,
  onSnoozeOneHour,
  onClose,
  onOpenTodo,
}) => {
  if (!isOpen) return null;

  const summary = buildReminderSummary(todos, now);

  const headerTitle =
    triggerReason === 'hourly'
      ? 'Saatlik Görev Hatırlatması'
      : triggerReason === 'deadline'
      ? 'Son Tarih (Deadline) Hatırlatması'
      : triggerReason === 'startup'
      ? 'Günlük Görev Hatırlatıcısı'
      : 'Hatırlatıcılar';

  const hasDeadlines =
    summary.overdue.length > 0 ||
    summary.upcomingSoon.length > 0 ||
    summary.hourlyActive.length > 0;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      role="region"
      aria-label="Görev Hatırlatıcısı"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            {triggerReason === 'hourly' || summary.overdue.length > 0 ? (
              <BellRing className="h-3.5 w-3.5" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-zinc-950 dark:text-zinc-50">
              {headerTitle}
            </h3>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {summary.totalActiveCount > 0
                ? `${summary.totalActiveCount} aktif görev · ${summary.overdue.length} gecikmiş`
                : 'Bekleyen aktif görev bulunmuyor'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Bildirimi kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 px-4 py-2 dark:divide-zinc-800/80">
        {summary.totalActiveCount === 0 ? (
          <div className="flex items-center gap-3 py-4 text-xs text-zinc-600 dark:text-zinc-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                Tüm görevleriniz tamamlanmış görünüyor
              </div>
              <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">
                Yeni görev ekleyip saatlik veya tarihli hatırlatma tanımlayabilirsiniz.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Overdue Deadlines */}
            {summary.overdue.length > 0 && (
              <div className="py-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Gecikmiş Son Tarihler ({summary.overdue.length})</span>
                </div>
                {summary.overdue.map((todo) => (
                  <button
                    key={todo.id}
                    type="button"
                    onClick={() => onOpenTodo(todo.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-red-200/80 bg-red-50/60 px-3 py-2 text-left transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {todo.title}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-red-600 tabular-nums dark:text-red-400">
                        {formatDeadline(todo.deadline!)} · {formatDeadlineRelative(todo.deadline!, now)}
                      </div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  </button>
                ))}
              </div>
            )}

            {/* Upcoming Soon Deadlines */}
            {summary.upcomingSoon.length > 0 && (
              <div className="py-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Yaklaşan Son Tarihler ({summary.upcomingSoon.length})</span>
                </div>
                {summary.upcomingSoon.map((todo) => (
                  <button
                    key={todo.id}
                    type="button"
                    onClick={() => onOpenTodo(todo.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-left transition-colors hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/25 dark:hover:bg-amber-950/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {todo.title}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-amber-700 tabular-nums dark:text-amber-300">
                        {formatDeadline(todo.deadline!)} · {formatDeadlineRelative(todo.deadline!, now)}
                        {todo.hourlyReminder ? ' · Saatlik' : ''}
                      </div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  </button>
                ))}
              </div>
            )}

            {/* Hourly Recurring Reminders */}
            {summary.hourlyActive.length > 0 && (
              <div className="py-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                  <span>Saatlik Hatırlatmalar ({summary.hourlyActive.length})</span>
                </div>
                {summary.hourlyActive.map((todo) => (
                  <button
                    key={todo.id}
                    type="button"
                    onClick={() => onOpenTodo(todo.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-left transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-blue-700"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {todo.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Saatlik hatırlatma açık
                        {todo.deadline ? ` · Hedef: ${formatDeadline(todo.deadline)}` : ''}
                      </div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  </button>
                ))}
              </div>
            )}

            {/* Active Tasks Without Deadlines (Always reminds user even when no deadline is set) */}
            {(summary.noDeadlineActive.length > 0 || !hasDeadlines) && (
              <div className="py-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                  <span>
                    {hasDeadlines
                      ? `Son Tarihi Girilmemiş Aktif Görevler (${summary.noDeadlineActive.length})`
                      : `Bekleyen Aktif Görevleriniz (${summary.totalActiveCount})`}
                  </span>
                </div>
                {(hasDeadlines ? summary.noDeadlineActive : todos.filter((t) => !t.completed))
                  .slice(0, 4)
                  .map((todo) => (
                    <button
                      key={todo.id}
                      type="button"
                      onClick={() => onOpenTodo(todo.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/70"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {todo.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          Öncelik: {PRIORITY_LABELS[todo.priority]}
                          {todo.deadline
                            ? ` · ${formatDeadline(todo.deadline)}`
                            : ' · Son tarih atanmamış'}
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/70">
        {notificationPermission === 'default' ? (
          <button
            type="button"
            onClick={onRequestBrowserPermission}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
          >
            Tarayıcı bildirimlerini aç
          </button>
        ) : (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {notificationPermission === 'granted'
              ? 'Tarayıcı bildirimleri etkin'
              : 'Uygulama içi hatırlatıcı aktif'}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onSnoozeOneHour}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            1 Saat Ertele
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 whitespace-nowrap"
          >
            Anlaşıldı
          </button>
        </div>
      </div>
    </div>
  );
};
