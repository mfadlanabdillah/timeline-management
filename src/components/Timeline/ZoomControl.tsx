import type { ZoomLevel } from './dateUtils';

interface ZoomControlProps {
  zoom: ZoomLevel;
  onChange: (zoom: ZoomLevel) => void;
}

export function ZoomControl({ zoom, onChange }: ZoomControlProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1 text-sm">
      {(['week', 'month'] as ZoomLevel[]).map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          className={`rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
            zoom === level
              ? 'bg-primary text-white'
              : 'text-text-muted hover:text-text'
          }`}
        >
          {level === 'week' ? 'Week' : 'Month'}
        </button>
      ))}
    </div>
  );
}
