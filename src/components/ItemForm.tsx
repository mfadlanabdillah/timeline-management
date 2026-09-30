import { useState } from 'react';
import type { TimelineItem } from '../types';
import { formatDate } from './Timeline/dateUtils';

interface ItemFormProps {
  projectId: string;
  initial?: TimelineItem | null;
  onClose: () => void;
  onSubmit: (data: {
    id?: string;
    name: string;
    startDate: string;
    endDate: string;
    color: string;
    isMilestone: boolean;
  }) => Promise<void>;
}

const COLOR_PRESETS = [
  '#6D5EF1', '#4F46E5', '#0EA5E9', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6',
];

export function ItemForm({ projectId, initial, onClose, onSubmit }: ItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? formatDate(new Date()));
  const [endDate, setEndDate] = useState(initial?.endDate ?? formatDate(new Date()));
  const [color, setColor] = useState(initial?.color ?? COLOR_PRESETS[0]);
  const [isMilestone, setIsMilestone] = useState(initial?.isMilestone ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    // A milestone is a single point in time, so it has no separate end date.
    const effectiveEnd = isMilestone ? startDate : endDate;
    if (new Date(effectiveEnd) < new Date(startDate)) {
      setError('End date must not be before start date');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        id: initial?.id,
        name: name.trim(),
        startDate,
        endDate: effectiveEnd,
        color,
        isMilestone,
      });
      onClose();
    } catch {
      setError('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="glass animate-scale-in w-full max-w-md rounded-2xl p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-text">
          {initial ? 'Edit Timeline Item' : 'Add Timeline Item'}
        </h2>
        {error && <p className="mb-3 text-sm text-issue">{error}</p>}
        <input type="hidden" value={projectId} readOnly />
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-text-muted">Item name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            placeholder="e.g. Design Phase"
          />
        </label>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isMilestone}
            onChange={(e) => setIsMilestone(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          <span className="font-medium text-text-muted">
            Milestone <span className="font-normal">(single date, no duration)</span>
          </span>
        </label>
        <div className="mb-3 flex gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-text-muted">
              {isMilestone ? 'Date' : 'Start'}
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          {!isMilestone && (
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium text-text-muted">End</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
          )}
        </div>
        <div className="mb-5">
          <span className="mb-1 block text-sm font-medium text-text-muted">Color</span>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ${
                  color === c ? 'ring-2 ring-primary' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded-full border border-border bg-transparent p-0"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
