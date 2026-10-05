import { useMemo } from 'react';
import type { TimelineItem } from '../../types';
import { addDays, diffDays, formatDate, parseDate, today } from './dateUtils';
import { clampPct } from './progressUtils';

interface SCurveChartProps {
  items: TimelineItem[];
}

const W = 640;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

/**
 * Cumulative planned vs actual completion across the whole project.
 * Planned assumes each item progresses linearly between its start and end date;
 * actual replays the recorded daily progress entries.
 */
export function SCurveChart({ items }: SCurveChartProps) {
  const data = useMemo(() => buildSeries(items), [items]);

  if (!data) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        Not enough data to draw a trend yet.
      </p>
    );
  }

  const { days, planned, actual, todayIndex } = data;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (days.length === 1 ? 0 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / 100) * innerH;

  const toPath = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  // The actual line only extends to today — the future is not reported yet.
  const actualUpToNow = actual.slice(0, todayIndex + 1);
  const latestActual = actualUpToNow[actualUpToNow.length - 1] ?? 0;
  const plannedNow = planned[Math.min(todayIndex, planned.length - 1)] ?? 0;
  const gap = Math.round(latestActual - plannedNow);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-text-muted">
          <span className="inline-block h-0.5 w-5 bg-text-muted" /> Planned
        </span>
        <span className="flex items-center gap-1.5 text-text-muted">
          <span className="inline-block h-0.5 w-5 bg-primary" /> Actual
        </span>
        <span
          className={`ml-auto font-semibold ${gap < 0 ? 'text-issue' : 'text-emerald-600 dark:text-emerald-400'}`}
        >
          {gap >= 0 ? `+${gap}` : gap}% vs plan
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Planned versus actual progress over time"
      >
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              className="text-border"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-current text-[9px] text-text-muted"
            >
              {v}
            </text>
          </g>
        ))}

        {todayIndex >= 0 && todayIndex < days.length && (
          <line
            x1={x(todayIndex)}
            x2={x(todayIndex)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="currentColor"
            className="text-today"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        <path d={toPath(planned)} fill="none" stroke="currentColor" className="text-text-muted" strokeWidth="1.5" strokeDasharray="4 3" />
        {actualUpToNow.length > 1 && (
          <path d={toPath(actualUpToNow)} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
        )}

        <text x={PAD.left} y={H - 8} className="fill-current text-[9px] text-text-muted">
          {formatDate(days[0])}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-current text-[9px] text-text-muted">
          {formatDate(days[days.length - 1])}
        </text>
      </svg>
    </div>
  );
}

function buildSeries(items: TimelineItem[]) {
  if (items.length === 0) return null;

  let min = parseDate(items[0].startDate);
  let max = parseDate(items[0].endDate);
  for (const item of items) {
    const s = parseDate(item.startDate);
    const e = parseDate(item.endDate);
    if (s < min) min = s;
    if (e > max) max = e;
  }

  const span = diffDays(min, max);
  if (span < 1) return null;

  // Sample at most ~60 points so long projects stay readable.
  const step = Math.max(1, Math.ceil(span / 60));
  const days: Date[] = [];
  for (let d = 0; d <= span; d += step) days.push(addDays(min, d));
  if (days[days.length - 1] < max) days.push(max);

  const weights = items.map(
    (item) => diffDays(parseDate(item.startDate), parseDate(item.endDate)) + 1,
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const planned = days.map((day) => {
    let sum = 0;
    items.forEach((item, idx) => {
      const s = parseDate(item.startDate);
      const e = parseDate(item.endDate);
      const total = diffDays(s, e) + 1;
      const elapsed = diffDays(s, day) + 1;
      const pct = elapsed <= 0 ? 0 : Math.min(100, (elapsed / total) * 100);
      sum += pct * weights[idx];
    });
    return clampPct(sum / totalWeight);
  });

  const actual = days.map((day) => {
    let sum = 0;
    items.forEach((item, idx) => {
      // Latest progress entry recorded on or before this day.
      const entries = (item.progressEntries ?? [])
        .filter((p) => parseDate(p.date) <= day)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      const pct = entries.length > 0 ? entries[entries.length - 1].percentage : 0;
      sum += clampPct(pct) * weights[idx];
    });
    return clampPct(sum / totalWeight);
  });

  const now = today();
  let todayIndex = days.findIndex((d) => d >= now);
  if (todayIndex === -1) todayIndex = days.length - 1;

  return { days, planned, actual, todayIndex };
}
