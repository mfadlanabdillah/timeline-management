import { useCallback, useEffect, useState } from 'react';
import { listAuditLogs } from '../api/audit';
import type { AuditAction, AuditLogEntry } from '../types';

interface ActivityLogModalProps {
  projectId: string;
  onClose: () => void;
}

const PAGE_SIZE = 25;

const ACTION_CLASS: Record<AuditAction, string> = {
  create: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  update: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  delete: 'bg-issue-bg text-issue',
  resolve: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  reopen: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
};

export function ActivityLogModal({ projectId, onClose }: ActivityLogModalProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (nextOffset: number, append: boolean) => {
      setLoading(true);
      listAuditLogs({ projectId, limit: PAGE_SIZE, offset: nextOffset })
        .then((page) => {
          setEntries((prev) => (append ? [...prev, ...page.entries] : page.entries));
          setTotal(page.total);
          setOffset(nextOffset);
          setError(null);
        })
        .catch(() => setError('Failed to load activity'))
        .finally(() => setLoading(false));
    },
    [projectId],
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  const hasMore = entries.length < total;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass animate-scale-in flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-semibold text-text">Activity log</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {total} recorded change{total === 1 ? '' : 's'} for this project
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-text-muted hover:bg-bg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="text-sm text-issue">{error}</p>}
          {!error && entries.length === 0 && !loading && (
            <p className="text-sm text-text-muted">No activity recorded yet.</p>
          )}

          <ol className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex gap-3 rounded-lg border border-border bg-bg p-3 text-sm"
              >
                <span
                  className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ACTION_CLASS[entry.action]}`}
                >
                  {entry.action}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-text">{entry.summary}</p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {entry.actor}
                    <span className="mx-1">·</span>
                    <span className={entry.actorType === 'guest' ? 'italic' : ''}>
                      {entry.actorType}
                    </span>
                    <span className="mx-1">·</span>
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {loading && <p className="mt-3 text-sm text-text-muted">Loading...</p>}
          {hasMore && !loading && (
            <button
              onClick={() => load(offset + PAGE_SIZE, true)}
              className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-medium text-text-muted hover:text-primary"
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
