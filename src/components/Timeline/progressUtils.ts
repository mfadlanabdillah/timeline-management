import type { ProgressEntry, TimelineItem } from '../../types';
import { diffDays, parseDate } from './dateUtils';

/** Current progress = the percentage of the entry with the latest date. */
export function currentProgress(entries?: ProgressEntry[]): number {
  if (!entries || entries.length === 0) return 0;
  let latest = entries[0];
  for (const e of entries) {
    if (e.date > latest.date) latest = e;
  }
  return clampPct(latest.percentage);
}

export function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Overall completion, weighted by each item's duration in days. */
export function overallProgress(items: TimelineItem[]): number {
  let weighted = 0;
  let totalDays = 0;
  for (const item of items) {
    const days = diffDays(parseDate(item.startDate), parseDate(item.endDate)) + 1;
    weighted += currentProgress(item.progressEntries) * days;
    totalDays += days;
  }
  if (totalDays === 0) return 0;
  return clampPct(weighted / totalDays);
}
