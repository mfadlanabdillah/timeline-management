import type { TimelineItem } from '../../types';
import { diffDays, formatDate, parseDate } from './dateUtils';
import { TimelineBar } from './TimelineBar';

interface TimelineRowProps {
  item: TimelineItem;
  rangeStart: Date;
  dayWidth: number;
  totalWidth: number;
  canEdit: boolean;
  isCritical: boolean;
  onOpen: (item: TimelineItem) => void;
  onDatesChange: (itemId: string, startDate: string, endDate: string) => void;
}

export function TimelineRow({
  item,
  rangeStart,
  dayWidth,
  totalWidth,
  canEdit,
  isCritical,
  onOpen,
  onDatesChange,
}: TimelineRowProps) {
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);
  const highlightLeft = diffDays(rangeStart, start) * dayWidth;
  const highlightWidth = (diffDays(start, end) + 1) * dayWidth;

  return (
    <div className="relative h-14 border-b border-border" style={{ width: totalWidth }}>
      {!item.isMilestone && (
        <div
          className="absolute inset-y-1 rounded-md"
          style={{
            left: highlightLeft,
            width: highlightWidth,
            backgroundColor: item.color,
            opacity: 0.12,
          }}
        />
      )}

      {item.isMilestone ? (
        <MilestoneMarker
          item={item}
          left={highlightLeft + dayWidth / 2}
          isCritical={isCritical}
          onOpen={onOpen}
        />
      ) : (
        <TimelineBar
          item={item}
          rangeStart={rangeStart}
          dayWidth={dayWidth}
          canEdit={canEdit}
          isCritical={isCritical}
          onOpen={onOpen}
          onDatesChange={onDatesChange}
        />
      )}
    </div>
  );
}

/** Zero-duration event drawn as a diamond on its start date. */
function MilestoneMarker({
  item,
  left,
  isCritical,
  onOpen,
}: {
  item: TimelineItem;
  left: number;
  isCritical: boolean;
  onOpen: (item: TimelineItem) => void;
}) {
  return (
    <div
      className="group absolute top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{ left }}
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(item)}
      aria-label={`Milestone ${item.name}`}
    >
      <div
        className={`h-4 w-4 rotate-45 rounded-[2px] shadow-sm transition-transform group-hover:scale-125 ${
          isCritical ? 'ring-2 ring-issue ring-offset-1' : ''
        }`}
        style={{ backgroundColor: item.color }}
      />
      <div className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1f1f28] px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
        ◆ {item.name}: {formatDate(parseDate(item.startDate))}
      </div>
    </div>
  );
}
