import {TodoPriority, TodoStatus} from '../types';

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  [TodoPriority.LOW]: 'Düşük',
  [TodoPriority.MEDIUM]: 'Orta',
  [TodoPriority.HIGH]: 'Yüksek',
};

export const STATUS_LABELS: Record<TodoStatus, string> = {
  [TodoStatus.TODO]: 'Yapılacak',
  [TodoStatus.IN_PROGRESS]: 'Devam Ediyor',
  [TodoStatus.DONE]: 'Tamamlandı',
};

export function formatTurkishDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
  }

  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatDeadline(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const timeStr = date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));

  if (dayDiff === 0) return `Bugün ${timeStr}`;
  if (dayDiff === 1) return `Yarın ${timeStr}`;
  if (dayDiff === -1) return `Dün ${timeStr}`;

  const datePart = date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
  return `${datePart} ${timeStr}`;
}

export function formatDeadlineRelative(timestamp: number, now = Date.now()): string {
  const diffMs = timestamp - now;
  const absMins = Math.round(Math.abs(diffMs) / 60000);

  if (absMins < 1) {
    return diffMs >= 0 ? 'Şimdi' : 'Az önce geçti';
  }

  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  let durationText = '';
  if (days > 0) {
    durationText = remHours > 0 ? `${days} gün ${remHours} sa` : `${days} gün`;
  } else if (hours > 0) {
    durationText = mins > 0 ? `${hours} sa ${mins} dk` : `${hours} saat`;
  } else {
    durationText = `${mins} dk`;
  }

  return diffMs >= 0 ? `${durationText} kaldı` : `${durationText} gecikti`;
}

export function toDateTimeLocalValue(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocalValue(val: string): number | null {
  if (!val) return null;
  const ms = new Date(val).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-');
}

export function normalizeCategory(raw: string | undefined | null): string {
  return (raw ?? '').trim();
}
