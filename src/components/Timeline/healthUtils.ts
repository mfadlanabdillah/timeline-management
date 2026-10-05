import type { Note, TimelineItem } from '../../types';
import { diffDays, parseDate, today } from './dateUtils';
import { currentProgress } from './progressUtils';

export type HealthStatus = 'done' | 'onTrack' | 'atRisk' | 'behind' | 'overdue' | 'notStarted';

export interface ItemHealth {
  status: HealthStatus;
  /** Latest reported completion, 0-100. */
  actual: number;
  /** Completion implied by the time elapsed so far, 0-100. */
  expected: number;
  /** actual - expected; negative means running late. */
  variance: number;
  daysRemaining: number;
}

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  done: 'Done',
  onTrack: 'On track',
  atRisk: 'At risk',
  behind: 'Behind',
  overdue: 'Overdue',
  notStarted: 'Not started',
};

/** Tailwind classes for the status pill. */
export const HEALTH_CLASS: Record<HealthStatus, string> = {
  done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  onTrack: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  atRisk: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  behind: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  overdue: 'bg-issue-bg text-issue',
  notStarted: 'bg-black/5 text-text-muted dark:bg-white/10',
};

/**
 * Compares reported progress against the progress implied by elapsed time.
 * An item 85% through its schedule but only 40% complete is "behind".
 */
export function itemHealth(item: TimelineItem): ItemHealth {
  const actual = currentProgress(item.progressEntries);
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);
  const now = today();

  const totalDays = diffDays(start, end) + 1;
  const elapsedDays = diffDays(start, now) + 1;
  const daysRemaining = diffDays(now, end);

  const expected =
    elapsedDays <= 0 ? 0 : Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const variance = actual - expected;

  let status: HealthStatus;
  if (actual >= 100) status = 'done';
  else if (daysRemaining < 0) status = 'overdue';
  else if (elapsedDays <= 0) status = 'notStarted';
  else if (variance >= -5) status = 'onTrack';
  else if (variance >= -20) status = 'atRisk';
  else status = 'behind';

  return { status, actual, expected, variance, daysRemaining };
}

export function openIssueCount(notes?: Note[]): number {
  return notes?.filter((n) => n.type === 'issue' && !n.resolved).length ?? 0;
}

export interface ProjectSummary {
  totalItems: number;
  completed: number;
  overdue: number;
  atRisk: number;
  openIssues: number;
  overallProgress: number;
}

/** Roll-up used by the dashboard cards and the timeline header. */
export function summarise(items: TimelineItem[]): ProjectSummary {
  let completed = 0;
  let overdue = 0;
  let atRisk = 0;
  let openIssues = 0;
  let weighted = 0;
  let totalDays = 0;

  for (const item of items) {
    const health = itemHealth(item);
    if (health.status === 'done') completed++;
    if (health.status === 'overdue') overdue++;
    if (health.status === 'atRisk' || health.status === 'behind') atRisk++;
    openIssues += openIssueCount(item.notes);

    const days = diffDays(parseDate(item.startDate), parseDate(item.endDate)) + 1;
    weighted += health.actual * days;
    totalDays += days;
  }

  return {
    totalItems: items.length,
    completed,
    overdue,
    atRisk,
    openIssues,
    overallProgress: totalDays === 0 ? 0 : Math.round(weighted / totalDays),
  };
}
