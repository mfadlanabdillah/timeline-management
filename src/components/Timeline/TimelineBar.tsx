import { useRef, useState } from 'react';
import type { TimelineItem } from '../../types';
import { addDays, diffDays, formatDate, parseDate } from './dateUtils';
import { openIssueCount } from './healthUtils';
import { currentProgress } from './progressUtils';

interface TimelineBarProps {
  item: TimelineItem;
  rangeStart: Date;
  dayWidth: number;
  canEdit: boolean;
  /** Sits on the critical path — any slip here delays the whole chain. */
  isCritical?: boolean;
  onOpen: (item: TimelineItem) => void;
  onDatesChange: (itemId: string, startDate: string, endDate: string) => void;
}

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

export function TimelineBar({
  item,
  rangeStart,
  dayWidth,
  canEdit,
  isCritical = false,
  onOpen,
  onDatesChange,
}: TimelineBarProps) {
  const [preview, setPreview] = useState<{ start: Date; end: Date } | null>(null);
  const dragState = useRef<{
    mode: DragMode;
    startX: number;
    originalStart: Date;
    originalEnd: Date;
    currentStart: Date;
    currentEnd: Date;
    moved: boolean;
  } | null>(null);

  const start = preview?.start ?? parseDate(item.startDate);
  const end = preview?.end ?? parseDate(item.endDate);
  const left = diffDays(rangeStart, start) * dayWidth;
  const width = (diffDays(start, end) + 1) * dayWidth;
  // Resolved issues no longer demand attention, so the badge counts open ones.
  const issueCount = openIssueCount(item.notes);
  const progress = currentProgress(item.progressEntries);

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    e.stopPropagation();
    const originalStart = parseDate(item.startDate);
    const originalEnd = parseDate(item.endDate);
    dragState.current = {
      mode,
      startX: e.clientX,
      originalStart,
      originalEnd,
      currentStart: originalStart,
      currentEnd: originalEnd,
      moved: false,
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore capture failures (e.g. synthetic events) */
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragState.current;
    if (!drag || !canEdit) return;
    const deltaX = e.clientX - drag.startX;
    const deltaDays = Math.round(deltaX / dayWidth);
    if (deltaDays !== 0) drag.moved = true;

    let newStart = drag.originalStart;
    let newEnd = drag.originalEnd;
    if (drag.mode === 'move') {
      newStart = addDays(drag.originalStart, deltaDays);
      newEnd = addDays(drag.originalEnd, deltaDays);
    } else if (drag.mode === 'resize-left') {
      newStart = addDays(drag.originalStart, deltaDays);
      if (newStart > drag.originalEnd) newStart = drag.originalEnd;
    } else if (drag.mode === 'resize-right') {
      newEnd = addDays(drag.originalEnd, deltaDays);
      if (newEnd < drag.originalStart) newEnd = drag.originalStart;
    }
    drag.currentStart = newStart;
    drag.currentEnd = newEnd;
    setPreview({ start: newStart, end: newEnd });
  }

  function onPointerUp() {
    const drag = dragState.current;
    dragState.current = null;
    if (!drag) return;
    if (!canEdit || !drag.moved) {
      setPreview(null);
      onOpen(item);
      return;
    }
    onDatesChange(item.id, formatDate(drag.currentStart), formatDate(drag.currentEnd));
    setPreview(null);
  }

  return (
    <div
      className={`group absolute top-1/2 z-[2] h-8 -translate-y-1/2 rounded-md shadow-sm transition-shadow hover:shadow-md ${
        isCritical ? 'ring-2 ring-issue ring-offset-1 ring-offset-surface' : ''
      }`}
      style={{ left, width: Math.max(width, dayWidth), backgroundColor: item.color }}
      onPointerDown={(e) => beginDrag('move', e)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="button"
      tabIndex={0}
    >
      {/* Progress fill — visually shows the item's latest completion %. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-white/30 transition-[width] duration-300"
        style={{ width: `${progress}%`, borderRadius: progress >= 100 ? '0.375rem' : undefined }}
      />
      <div className="relative z-[1] flex h-full items-center justify-between gap-1 overflow-hidden rounded-md px-2">
        <span className="truncate text-xs font-medium text-white drop-shadow-sm">
          {item.name}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-[10px] font-semibold text-white/95 drop-shadow-sm">
            {progress}%
          </span>
          {issueCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-issue px-1 text-[10px] font-semibold text-white">
              {issueCount}
            </span>
          )}
        </span>
      </div>
      {canEdit && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
            onPointerDown={(e) => beginDrag('resize-left', e)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div className="mx-auto h-full w-1 rounded bg-white/70" />
          </div>
          <div
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
            onPointerDown={(e) => beginDrag('resize-right', e)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div className="mx-auto h-full w-1 rounded bg-white/70" />
          </div>
        </>
      )}
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1f1f28] px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
        {item.name}: {formatDate(start)} → {formatDate(end)} · {progress}%
      </div>
    </div>
  );
}
