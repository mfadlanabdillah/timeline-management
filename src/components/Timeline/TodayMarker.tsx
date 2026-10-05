import { diffDays, today } from './dateUtils';

interface TodayMarkerProps {
  rangeStart: Date;
  dayWidth: number;
  height: number;
}

export function TodayMarker({ rangeStart, dayWidth, height }: TodayMarkerProps) {
  const offset = diffDays(rangeStart, today()) * dayWidth + dayWidth / 2;
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-px bg-today/70"
      style={{ left: offset, height }}
    >
      <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-today" />
    </div>
  );
}
