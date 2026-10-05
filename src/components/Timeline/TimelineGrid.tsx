import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemDependency, TimelineItem } from '../../types';
import { computeCriticalPath } from './criticalPath';
import {
  DAY_WIDTH,
  buildDays,
  computeRange,
  dayLabel,
  isSameDay,
  monthLabel,
  today,
  type ZoomLevel,
} from './dateUtils';
import { DependencyArrows } from './DependencyArrows';
import {
  HEALTH_CLASS,
  HEALTH_LABEL,
  itemHealth,
  openIssueCount,
  summarise,
  type HealthStatus,
} from './healthUtils';
import { EmptyStateIllustration } from '../illustrations/EmptyStateIllustration';
import { SCurveChart } from './SCurveChart';
import { TimelineRow } from './TimelineRow';
import { TodayMarker } from './TodayMarker';
import { ZoomControl } from './ZoomControl';

interface TimelineGridProps {
  items: TimelineItem[];
  canEdit: boolean;
  dependencies?: ItemDependency[];
  onOpenItem: (item: TimelineItem) => void;
  onDatesChange: (itemId: string, startDate: string, endDate: string) => void;
  /** Admin-only: persist a new item order. Absent for guests (read-only). */
  onReorder?: (orderedIds: string[]) => void;
}

type StatusFilter = 'all' | HealthStatus | 'openIssues';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'onTrack', label: 'On track' },
  { value: 'atRisk', label: 'At risk' },
  { value: 'behind', label: 'Behind' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'done', label: 'Done' },
  { value: 'notStarted', label: 'Not started' },
  { value: 'openIssues', label: 'Has open issues' },
];

const ROW_HEIGHT = 56;
const MIN_LABEL_WIDTH = 140;
const MAX_LABEL_WIDTH = 560;
const DEFAULT_LABEL_WIDTH = 200;
const LABEL_WIDTH_KEY = 'timeline_label_width';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function TimelineGrid({
  items: allItems,
  canEdit,
  dependencies = [],
  onOpenItem,
  onDatesChange,
  onReorder,
}: TimelineGridProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const dayWidth = DAY_WIDTH[zoom];

  // --- Search & status filter ---
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showChart, setShowChart] = useState(false);

  const summary = useMemo(() => summarise(allItems), [allItems]);
  const criticalPath = useMemo(
    () => computeCriticalPath(allItems, dependencies),
    [allItems, dependencies],
  );

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (term && !item.name.toLowerCase().includes(term)) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'openIssues') return openIssueCount(item.notes) > 0;
      return itemHealth(item).status === statusFilter;
    });
  }, [allItems, search, statusFilter]);

  const isFiltered = items.length !== allItems.length;
  // Reordering rows while a filter hides some of them would scramble positions.
  const reorderEnabled = !isFiltered && search.trim() === '';

  // --- Resizable label column (persisted per-user in localStorage) ---
  const [labelWidth, setLabelWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(LABEL_WIDTH_KEY));
    return stored >= MIN_LABEL_WIDTH && stored <= MAX_LABEL_WIDTH ? stored : DEFAULT_LABEL_WIDTH;
  });
  useEffect(() => {
    localStorage.setItem(LABEL_WIDTH_KEY, String(labelWidth));
  }, [labelWidth]);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startWidth: labelWidth };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore capture failures (e.g. synthetic events) */
    }
  }
  function moveResize(e: React.PointerEvent) {
    if (!resizeRef.current) return;
    const delta = e.clientX - resizeRef.current.startX;
    setLabelWidth(clamp(resizeRef.current.startWidth + delta, MIN_LABEL_WIDTH, MAX_LABEL_WIDTH));
  }
  function endResize() {
    resizeRef.current = null;
  }

  // --- Drag & drop reorder (admin only) ---
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ from: number; to: number } | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  const displayItems = useMemo(() => {
    if (!drag || drag.from === drag.to) return items;
    return arrayMove(items, drag.from, drag.to);
  }, [items, drag]);
  const draggedId = drag ? items[drag.from]?.id : null;

  function startReorder(index: number, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const state = { from: index, to: index };
    dragRef.current = state;
    setDrag(state);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore capture failures (e.g. synthetic events) */
    }
  }
  function moveReorder(e: React.PointerEvent) {
    if (!dragRef.current || !listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    const idx = clamp(Math.floor((e.clientY - rect.top) / ROW_HEIGHT), 0, items.length - 1);
    if (idx !== dragRef.current.to) {
      const state = { from: dragRef.current.from, to: idx };
      dragRef.current = state;
      setDrag(state);
    }
  }
  function endReorder() {
    const state = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (state && state.from !== state.to && onReorder) {
      onReorder(arrayMove(items, state.from, state.to).map((i) => i.id));
    }
  }

  // Range comes from the full set so the date axis stays put while filtering.
  const range = useMemo(() => computeRange(allItems), [allItems]);
  const days = useMemo(() => buildDays(range), [range]);
  const totalWidth = days.length * dayWidth;

  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; width: number }[] = [];
    for (const d of days) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.width += dayWidth;
      } else {
        groups.push({ key, label: `${monthLabel(d)} ${d.getFullYear()}`, width: dayWidth });
      }
    }
    return groups;
  }, [days, dayWidth]);

  const bodyHeight = Math.max(items.length * ROW_HEIGHT, ROW_HEIGHT);
  const todayVisible = days.some((d) => isSameDay(d, today()));
  const canReorder = canEdit && !!onReorder && reorderEnabled;
  const overall = summary.overallProgress;

  return (
    <div className="glass animate-fade-up flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full bg-today opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-today" />
          </span>
          <span>Today</span>
          {!todayVisible && <span className="text-xs italic">(outside visible range)</span>}
        </div>
        {/* Aggregated overall completion across the timeline (weighted by duration). */}
        <div className="flex min-w-[180px] flex-1 items-center gap-2 sm:max-w-xs">
          <span className="whitespace-nowrap text-xs font-medium text-text-muted">
            Overall progress
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="bg-brand-gradient h-full rounded-full transition-[width] duration-700"
              style={{ width: `${overall}%` }}
            />
          </div>
          <span className="w-9 whitespace-nowrap text-right text-xs font-semibold text-gradient">
            {overall}%
          </span>
        </div>
        <ZoomControl zoom={zoom} onChange={setZoom} />
      </div>

      {/* Health roll-up: what needs attention, at a glance. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2 text-xs">
        <Stat label="Items" value={summary.totalItems} />
        <Stat label="Done" value={summary.completed} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="At risk" value={summary.atRisk} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Overdue" value={summary.overdue} tone="text-issue" />
        <Stat label="Open issues" value={summary.openIssues} tone="text-issue" />
        <button
          onClick={() => setShowChart((v) => !v)}
          className={`lift ml-auto rounded-xl border px-3 py-1.5 font-medium ${
            showChart
              ? 'bg-brand-gradient border-transparent text-white shadow-md shadow-primary/25'
              : 'border-border text-text-muted hover:border-primary/40 hover:text-primary'
          }`}
        >
          {showChart ? 'Hide trend' : 'Progress trend'}
        </button>
      </div>

      {showChart && (
        <div className="animate-fade-up border-b border-border/70 px-4 py-3">
          <SCurveChart items={allItems} />
        </div>
      )}

      {/* Search & status filter */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          aria-label="Search timeline items"
          className="min-w-[160px] flex-1 rounded-xl border border-border bg-surface/60 px-3 py-1.5 text-sm text-text outline-none transition-shadow placeholder:text-text-muted/60 focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_16%,transparent)] sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="rounded-xl border border-border bg-surface/60 px-2 py-1.5 text-sm text-text outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_16%,transparent)]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {isFiltered && (
          <>
            <span className="text-xs text-text-muted">
              {items.length} of {allItems.length}
            </span>
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear
            </button>
          </>
        )}
        {criticalPath.size > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
            <span className="inline-block h-2.5 w-4 rounded-sm ring-2 ring-issue" />
            Critical path ({criticalPath.size})
          </span>
        )}
      </div>

      <div className="relative flex-1 overflow-auto">
        <div style={{ width: labelWidth + totalWidth }}>
          {/* Sticky header */}
          <div className="sticky top-0 z-20 flex bg-surface">
            <div
              className="sticky left-0 z-30 flex items-end border-r border-b border-border bg-surface"
              style={{ width: labelWidth, minWidth: labelWidth }}
            >
              <span className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Timeline Item
              </span>
              {/* Column resize handle */}
              <div
                onPointerDown={startResize}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                title="Drag to resize column"
                className="group absolute top-0 right-0 z-40 h-full w-2 cursor-col-resize touch-none select-none"
              >
                <div className="mx-auto h-full w-px bg-border transition-colors group-hover:bg-primary" />
              </div>
            </div>
            <div>
              <div className="flex border-b border-border" style={{ height: 24 }}>
                {monthGroups.map((g) => (
                  <div
                    key={g.key}
                    style={{ width: g.width }}
                    className="flex items-center justify-center border-r border-border text-[11px] font-medium text-text-muted"
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              <div className="flex border-b border-border" style={{ height: 32 }}>
                {days.map((d, i) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = isSameDay(d, today());
                  return (
                    <div
                      key={i}
                      style={{ width: dayWidth }}
                      className={`flex flex-col items-center justify-center border-r border-border text-[10px] leading-tight ${
                        isToday
                          ? 'bg-primary/10 font-semibold text-primary'
                          : weekend
                            ? 'bg-black/[0.02] text-text-muted'
                            : 'text-text-muted'
                      }`}
                    >
                      {zoom === 'week' && <span>{dayLabel(d)}</span>}
                      <span>{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex">
            <div
              ref={listRef}
              className="sticky left-0 z-10 border-r border-border bg-surface"
              style={{ width: labelWidth, minWidth: labelWidth }}
            >
              {items.length === 0 && (
                <div className="flex flex-col items-center px-4 py-8 text-center">
                  {allItems.length === 0 ? (
                    <>
                      <EmptyStateIllustration className="w-40 max-w-full" />
                      <p className="mt-3 text-sm font-medium text-text">No timeline items yet</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Add your first item to start tracking.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-text-muted">No items match the current filter.</p>
                  )}
                </div>
              )}
              {displayItems.map((item) => {
                const dragging = draggedId === item.id;
                const health = itemHealth(item);
                const openIssues = openIssueCount(item.notes);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 border-b border-border pr-3 transition-colors ${
                      dragging ? 'bg-primary/10' : ''
                    }`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {canReorder && (
                      <span
                        onPointerDown={(e) => startReorder(displayItems.indexOf(item), e)}
                        onPointerMove={moveReorder}
                        onPointerUp={endReorder}
                        onPointerCancel={endReorder}
                        title="Drag to reorder"
                        className="flex h-full cursor-grab touch-none select-none items-center px-1.5 text-text-muted hover:text-primary active:cursor-grabbing"
                        aria-label="Reorder item"
                      >
                        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
                          <circle cx="2" cy="3" r="1.4" />
                          <circle cx="8" cy="3" r="1.4" />
                          <circle cx="2" cy="8" r="1.4" />
                          <circle cx="8" cy="8" r="1.4" />
                          <circle cx="2" cy="13" r="1.4" />
                          <circle cx="8" cy="13" r="1.4" />
                        </svg>
                      </span>
                    )}
                    {item.isMilestone ? (
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rotate-45 rounded-[1px] ${canReorder ? '' : 'ml-3'}`}
                        style={{ backgroundColor: item.color }}
                        title="Milestone"
                      />
                    ) : (
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${canReorder ? '' : 'ml-3'}`}
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-text" title={item.name}>
                          {item.name}
                        </span>
                        {openIssues > 0 && (
                          <span
                            className="shrink-0 rounded-full bg-issue px-1.5 text-[10px] font-semibold text-white"
                            title={`${openIssues} open issue${openIssues > 1 ? 's' : ''}`}
                          >
                            {openIssues}
                          </span>
                        )}
                      </div>
                      {/* Schedule health: actual vs time-elapsed expectation. */}
                      <div className="mt-0.5 flex items-center gap-1">
                        <span
                          className={`rounded-full px-1.5 py-px text-[10px] font-medium ${HEALTH_CLASS[health.status]}`}
                          title={`${health.actual}% done, ~${health.expected}% expected by now`}
                        >
                          {HEALTH_LABEL[health.status]}
                        </span>
                        {health.variance < 0 && health.status !== 'done' && (
                          <span className="text-[10px] text-text-muted">
                            {health.variance}%
                          </span>
                        )}
                        {criticalPath.has(item.id) && (
                          <span className="text-[10px] font-semibold text-issue" title="On the critical path">
                            CP
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="relative">
              {displayItems.map((item) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  rangeStart={range.start}
                  dayWidth={dayWidth}
                  totalWidth={totalWidth}
                  canEdit={canEdit}
                  isCritical={criticalPath.has(item.id)}
                  onOpen={onOpenItem}
                  onDatesChange={onDatesChange}
                />
              ))}
              <DependencyArrows
                items={displayItems}
                dependencies={dependencies}
                rangeStart={range.start}
                dayWidth={dayWidth}
                rowHeight={ROW_HEIGHT}
                width={totalWidth}
                height={bodyHeight}
                criticalPath={criticalPath}
              />
              <TodayMarker rangeStart={range.start} dayWidth={dayWidth} height={bodyHeight} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="flex items-center gap-1 rounded-xl border border-border/60 bg-surface/50 px-2.5 py-1">
      <span className={`font-semibold ${tone ?? 'text-text'}`}>{value}</span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}
