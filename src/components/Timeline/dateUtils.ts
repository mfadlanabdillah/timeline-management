export type ZoomLevel = 'week' | 'month';

export const DAY_WIDTH: Record<ZoomLevel, number> = {
  week: 48,
  month: 18,
};

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function diffDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function dayLabel(date: Date): string {
  return DAY_LABELS[date.getDay()];
}

export function monthLabel(date: Date): string {
  return MONTH_LABELS[date.getMonth()];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function computeRange(items: { startDate: string; endDate: string }[]): DateRange {
  const t = today();
  let min = addDays(t, -14);
  let max = addDays(t, 30);
  for (const item of items) {
    const s = parseDate(item.startDate);
    const e = parseDate(item.endDate);
    if (s < min) min = s;
    if (e > max) max = e;
  }
  return { start: addDays(min, -7), end: addDays(max, 7) };
}

export function buildDays(range: DateRange): Date[] {
  const days: Date[] = [];
  let cursor = range.start;
  const total = diffDays(range.start, range.end);
  for (let i = 0; i <= total; i++) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}
