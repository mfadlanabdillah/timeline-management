import type { ItemDependency, TimelineItem } from '../../types';
import { diffDays, parseDate } from './dateUtils';

interface DependencyArrowsProps {
  items: TimelineItem[];
  dependencies: ItemDependency[];
  rangeStart: Date;
  dayWidth: number;
  rowHeight: number;
  width: number;
  height: number;
  criticalPath: Set<string>;
}

/**
 * Finish-to-start connectors drawn as an overlay above the rows. Only links
 * whose endpoints are both visible are rendered.
 */
export function DependencyArrows({
  items,
  dependencies,
  rangeStart,
  dayWidth,
  rowHeight,
  width,
  height,
  criticalPath,
}: DependencyArrowsProps) {
  const rowIndex = new Map(items.map((item, i) => [item.id, i]));

  const paths = dependencies
    .map((dep) => {
      const fromRow = rowIndex.get(dep.predecessorId);
      const toRow = rowIndex.get(dep.successorId);
      if (fromRow === undefined || toRow === undefined) return null;

      const from = items[fromRow];
      const to = items[toRow];

      const fromEnd = (diffDays(rangeStart, parseDate(from.endDate)) + 1) * dayWidth;
      const toStart = diffDays(rangeStart, parseDate(to.startDate)) * dayWidth;
      const y1 = fromRow * rowHeight + rowHeight / 2;
      const y2 = toRow * rowHeight + rowHeight / 2;

      // Route out of the predecessor, across, then into the successor's left edge.
      const stub = 10;
      const midX = Math.max(fromEnd + stub, toStart - stub);
      const d = `M ${fromEnd} ${y1} H ${midX} V ${y2} H ${toStart - 4}`;

      const critical =
        criticalPath.has(dep.predecessorId) && criticalPath.has(dep.successorId);
      return { id: dep.id, d, critical, arrowX: toStart - 4, arrowY: y2 };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[1]"
      width={width}
      height={height}
      aria-hidden="true"
    >
      {paths.map((p) => (
        <g key={p.id} className={p.critical ? 'text-issue' : 'text-text-muted'}>
          <path
            d={p.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={p.critical ? 1.8 : 1.2}
            opacity={p.critical ? 0.9 : 0.5}
          />
          <polygon
            points={`${p.arrowX},${p.arrowY} ${p.arrowX - 5},${p.arrowY - 3.5} ${p.arrowX - 5},${p.arrowY + 3.5}`}
            fill="currentColor"
            opacity={p.critical ? 0.9 : 0.5}
          />
        </g>
      ))}
    </svg>
  );
}
