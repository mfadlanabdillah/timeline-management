import { useEffect, useMemo, useState } from 'react';
import type { ItemDependency, Note, NoteType, ProgressEntry, TimelineItem } from '../types';
import { createDependency, deleteDependency } from '../api/dependencies';
import {
  createNote,
  createNoteReply,
  deleteNote,
  deleteNoteReply,
  listNotes,
  setNoteEvidence,
  setNoteResolved,
} from '../api/notes';
import { deleteProgress, listProgress, upsertProgress } from '../api/progress';
import { formatDate, parseDate } from './Timeline/dateUtils';
import { clampPct, currentProgress } from './Timeline/progressUtils';

interface ItemDetailModalProps {
  item: TimelineItem;
  isAdmin: boolean;
  currentUserLabel: string;
  /** Guest's project code — proves their right to read/write this item. */
  projectCode?: string;
  /** Sibling items and links, used by the admin-only dependency editor. */
  allItems?: TimelineItem[];
  dependencies?: ItemDependency[];
  onDependenciesChange?: () => void | Promise<void>;
  onClose: () => void;
  onEditItem?: (item: TimelineItem) => void;
  onDeleteItem?: (item: TimelineItem) => void;
}

/** Guests re-use their name for the rest of the browser session. */
const GUEST_NAME_KEY = 'timeline_guest_name';

/**
 * Mirrors the API's evidence-link rule so a bad paste is caught before the
 * round trip. Anything not http(s) is rejected.
 */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function ItemDetailModal({
  item,
  isAdmin,
  currentUserLabel,
  projectCode,
  allItems = [],
  dependencies = [],
  onDependenciesChange,
  onClose,
  onEditItem,
  onDeleteItem,
}: ItemDetailModalProps) {
  const [notes, setNotes] = useState<Note[]>(item.notes ?? []);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<NoteType>('note');
  const [date, setDate] = useState(formatDate(new Date()));
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Evidence link (admin only to write; everyone can open it) ---
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  /** Note whose evidence link is being edited inline, if any. */
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState('');

  // --- Replies (one level deep; a reply cannot be replied to) ---
  /** Note whose reply box is open, if any. */
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);

  // --- Guest author name (required for guests, remembered for the session) ---
  const [guestName, setGuestName] = useState(
    () => sessionStorage.getItem(GUEST_NAME_KEY) ?? '',
  );
  const [nameError, setNameError] = useState<string | null>(null);

  // --- Progress state ---
  const [progress, setProgress] = useState<ProgressEntry[]>(item.progressEntries ?? []);
  const [progressDate, setProgressDate] = useState(formatDate(new Date()));
  const [pct, setPct] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  // --- Dependency editor (admin) ---
  const [newPredecessor, setNewPredecessor] = useState('');
  const [depError, setDepError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listNotes(item.id, projectCode), listProgress(item.id, projectCode)])
      .then(([n, p]) => {
        setNotes(n);
        setProgress(p);
        // Pre-fill the percentage input with the current progress.
        setPct(currentProgress(p));
      })
      .catch(() => setError('Failed to load item details'))
      .finally(() => setLoading(false));
  }, [item.id, projectCode]);

  const current = currentProgress(progress);
  const sortedProgress = useMemo(
    () => [...progress].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [progress],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      const list = map.get(n.date) ?? [];
      list.push(n);
      map.set(n.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [notes]);

  const issueCount = notes.filter((n) => n.type === 'issue' && !n.resolved).length;

  const itemsById = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const predecessors = useMemo(
    () =>
      dependencies
        .filter((d) => d.successorId === item.id)
        .map((link) => ({ link, other: itemsById.get(link.predecessorId) })),
    [dependencies, item.id, itemsById],
  );
  const successors = useMemo(
    () =>
      dependencies
        .filter((d) => d.predecessorId === item.id)
        .map((link) => ({ link, other: itemsById.get(link.successorId) })),
    [dependencies, item.id, itemsById],
  );
  /** Excludes itself and anything already linked in either direction. */
  const availablePredecessors = useMemo(() => {
    const linked = new Set([
      ...predecessors.map((p) => p.other?.id),
      ...successors.map((s) => s.other?.id),
    ]);
    return allItems.filter((i) => i.id !== item.id && !linked.has(i.id));
  }, [allItems, item.id, predecessors, successors]);

  async function handleProgressSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProgress(true);
    setProgressError(null);
    try {
      const saved = await upsertProgress({
        itemId: item.id,
        date: progressDate,
        percentage: clampPct(pct),
      });
      setProgress((prev) => [...prev.filter((p) => p.date !== saved.date), saved]);
    } catch {
      setProgressError('Failed to save progress');
    } finally {
      setSavingProgress(false);
    }
  }

  async function handleDeleteProgress(id: string) {
    try {
      await deleteProgress(id);
      setProgress((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setProgressError('Failed to delete progress');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    // Admins are identified by their account; guests must name themselves.
    const author = isAdmin ? currentUserLabel : guestName.trim();
    if (!isAdmin && !author) {
      setNameError('Name is required');
      return;
    }
    setNameError(null);

    // Only admins can attach evidence, so guests never reach this check.
    const evidence = isAdmin ? evidenceUrl.trim() : '';
    if (evidence && !isHttpUrl(evidence)) {
      setEvidenceError('Enter a full link starting with http:// or https://');
      return;
    }
    setEvidenceError(null);

    setSubmitting(true);
    setError(null);
    try {
      const created = await createNote(
        {
          itemId: item.id,
          date,
          content: content.trim(),
          type,
          createdBy: author,
          ...(evidence ? { evidenceUrl: evidence } : {}),
        },
        projectCode,
      );
      if (!isAdmin) sessionStorage.setItem(GUEST_NAME_KEY, author);
      setNotes((prev) => [created, ...prev]);
      setContent('');
      setEvidenceUrl('');
    } catch {
      setError('Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  }

  function startReply(note: Note) {
    setReplyingToId(note.id);
    setReplyDraft('');
    setReplyError(null);
  }

  async function handleSendReply(note: Note) {
    const body = replyDraft.trim();
    if (!body) return;

    // Same authorship rule as notes: admins by account, guests by name.
    const author = isAdmin ? currentUserLabel : guestName.trim();
    if (!isAdmin && !author) {
      setReplyError('Name is required');
      return;
    }

    setSendingReply(true);
    setReplyError(null);
    try {
      const created = await createNoteReply(
        note.id,
        { content: body, createdBy: author },
        projectCode,
      );
      if (!isAdmin) sessionStorage.setItem(GUEST_NAME_KEY, author);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, replies: [...(n.replies ?? []), created] } : n,
        ),
      );
      setReplyingToId(null);
      setReplyDraft('');
    } catch {
      setReplyError('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleDeleteReply(noteId: string, replyId: string) {
    try {
      await deleteNoteReply(noteId, replyId);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, replies: (n.replies ?? []).filter((r) => r.id !== replyId) }
            : n,
        ),
      );
    } catch {
      setError('Failed to delete reply');
    }
  }

  function startEditingEvidence(note: Note) {
    setEditingEvidenceId(note.id);
    setEvidenceDraft(note.evidenceUrl ?? '');
    setEvidenceError(null);
  }

  async function handleSaveEvidence(noteId: string) {
    const next = evidenceDraft.trim();
    if (next && !isHttpUrl(next)) {
      setEvidenceError('Enter a full link starting with http:// or https://');
      return;
    }
    setEvidenceError(null);
    try {
      // An empty box means "remove the link".
      const updated = await setNoteEvidence(noteId, next || null);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditingEvidenceId(null);
    } catch {
      setEvidenceError('Failed to save evidence link');
    }
  }

  async function handleAddDependency(e: React.FormEvent) {
    e.preventDefault();
    if (!newPredecessor) return;
    setDepError(null);
    try {
      await createDependency({ predecessorId: newPredecessor, successorId: item.id });
      setNewPredecessor('');
      await onDependenciesChange?.();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setDepError(typeof message === 'string' ? message : 'Failed to add dependency');
    }
  }

  async function handleRemoveDependency(id: string) {
    setDepError(null);
    try {
      await deleteDependency(id);
      await onDependenciesChange?.();
    } catch {
      setDepError('Failed to remove dependency');
    }
  }

  async function handleToggleResolved(note: Note) {
    try {
      const updated = await setNoteResolved(note.id, !note.resolved);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch {
      setError('Failed to update issue status');
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      setError('Failed to delete entry');
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass animate-scale-in flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <h2 className="break-words text-lg font-semibold text-text">{item.name}</h2>
              {issueCount > 0 && (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-issue-bg px-2 py-0.5 text-xs font-semibold text-issue">
                  {issueCount} open issue{issueCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {formatDate(parseDate(item.startDate))} → {formatDate(parseDate(item.endDate))}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && onEditItem && (
              <button
                onClick={() => onEditItem(item)}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg"
              >
                Edit
              </button>
            )}
            {isAdmin && onDeleteItem && (
              <button
                onClick={() => onDeleteItem(item)}
                className="rounded-md border border-issue/30 px-2.5 py-1 text-xs font-medium text-issue hover:bg-issue-bg"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-text-muted hover:bg-bg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-text-muted">Loading...</p>}

          {/* --- Progress section --- */}
          <section className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Progress
              </h3>
              <span className="text-sm font-semibold text-text">{current}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${current}%` }}
              />
            </div>

            {isAdmin && (
              <form onSubmit={handleProgressSubmit} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-text-muted">Date</span>
                  <input
                    type="date"
                    value={progressDate}
                    onChange={(e) => setProgressDate(e.target.value)}
                    className="rounded-lg border border-border bg-bg px-2 py-1.5 text-text"
                  />
                </label>
                <label className="flex-1 text-xs">
                  <span className="mb-1 block font-medium text-text-muted">
                    Progress: {clampPct(pct)}%
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={(e) => setPct(Number(e.target.value))}
                      className="flex-1 accent-[var(--color-primary)]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={(e) => setPct(clampPct(Number(e.target.value)))}
                      className="w-16 rounded-lg border border-border bg-bg px-2 py-1.5 text-text"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={savingProgress}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  Save
                </button>
              </form>
            )}
            {progressError && <p className="mt-2 text-xs text-issue">{progressError}</p>}

            {sortedProgress.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Daily history
                </p>
                {sortedProgress.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-md bg-bg px-2.5 py-1.5 text-xs"
                  >
                    <span className="w-24 shrink-0 text-text-muted">{p.date}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${clampPct(p.percentage)}%` }}
                      />
                    </div>
                    <span className="w-9 text-right font-semibold text-text">
                      {clampPct(p.percentage)}%
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteProgress(p.id)}
                        className="shrink-0 text-text-muted hover:text-issue"
                        aria-label="Delete progress entry"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* --- Dependencies (admin) --- */}
          {isAdmin && allItems.length > 1 && (
            <section className="mb-5">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Dependencies
              </h3>

              {predecessors.length === 0 && successors.length === 0 && (
                <p className="text-xs text-text-muted">No links yet.</p>
              )}

              <div className="space-y-1">
                {predecessors.map(({ link, other }) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 rounded-md bg-bg px-2.5 py-1.5 text-xs"
                  >
                    <span className="shrink-0 text-text-muted">Waits for</span>
                    <span className="truncate font-medium text-text">{other?.name ?? '—'}</span>
                    <button
                      onClick={() => handleRemoveDependency(link.id)}
                      className="ml-auto shrink-0 text-text-muted hover:text-issue"
                      aria-label="Remove dependency"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {successors.map(({ link, other }) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 rounded-md bg-bg px-2.5 py-1.5 text-xs"
                  >
                    <span className="shrink-0 text-text-muted">Blocks</span>
                    <span className="truncate font-medium text-text">{other?.name ?? '—'}</span>
                    <button
                      onClick={() => handleRemoveDependency(link.id)}
                      className="ml-auto shrink-0 text-text-muted hover:text-issue"
                      aria-label="Remove dependency"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddDependency} className="mt-2 flex gap-2">
                <select
                  value={newPredecessor}
                  onChange={(e) => setNewPredecessor(e.target.value)}
                  aria-label="Add a predecessor"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
                >
                  <option value="">This item waits for...</option>
                  {availablePredecessors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!newPredecessor}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  Link
                </button>
              </form>
              {depError && <p className="mt-1.5 text-xs text-issue">{depError}</p>}
            </section>
          )}

          {/* --- Notes & issues section --- */}
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Notes &amp; Issues
          </h3>
          {!loading && grouped.length === 0 && (
            <p className="text-sm text-text-muted">No notes or issues yet.</p>
          )}
          <div className="space-y-4">
            {grouped.map(([groupDate, entries]) => (
              <div key={groupDate}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {groupDate}
                </p>
                <div className="space-y-2">
                  {entries.map((n) => {
                    const openIssue = n.type === 'issue' && !n.resolved;
                    return (
                      <div
                        key={n.id}
                        className={`rounded-lg border p-3 text-sm ${
                          openIssue
                            ? 'border-issue/30 bg-issue-bg text-issue'
                            : 'border-border bg-bg text-text'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="mr-2 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase dark:bg-white/15">
                              {n.type === 'issue' ? 'Issue' : 'Note'}
                            </span>
                            {n.type === 'issue' && n.resolved && (
                              <span className="mr-2 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                                Resolved
                              </span>
                            )}
                            <span className={n.resolved ? 'line-through opacity-70' : ''}>
                              {n.content}
                            </span>
                          </div>
                          {isAdmin && (
                            <div className="flex shrink-0 gap-2 text-xs">
                              <button
                                onClick={() =>
                                  editingEvidenceId === n.id
                                    ? setEditingEvidenceId(null)
                                    : startEditingEvidence(n)
                                }
                                className="text-text-muted hover:text-primary"
                              >
                                {n.evidenceUrl ? 'Edit link' : 'Add link'}
                              </button>
                              {n.type === 'issue' && (
                                <button
                                  onClick={() => handleToggleResolved(n)}
                                  className="text-text-muted hover:text-primary"
                                >
                                  {n.resolved ? 'Reopen' : 'Resolve'}
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(n.id)}
                                className="text-text-muted hover:text-issue"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        {n.evidenceUrl && (
                          <a
                            href={n.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={n.evidenceUrl}
                            className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-primary hover:bg-bg"
                          >
                            <span aria-hidden="true">🔗</span>
                            <span className="truncate">View evidence</span>
                          </a>
                        )}
                        {isAdmin && editingEvidenceId === n.id && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <input
                              value={evidenceDraft}
                              onChange={(e) => setEvidenceDraft(e.target.value)}
                              placeholder="https://drive.google.com/..."
                              aria-label="Evidence link"
                              className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1 text-xs text-text outline-none focus:border-primary"
                            />
                            <button
                              onClick={() => handleSaveEvidence(n.id)}
                              className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-dark"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingEvidenceId(null)}
                              className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {isAdmin && editingEvidenceId === n.id && evidenceError && (
                          <p className="mt-1 text-[11px] text-issue">{evidenceError}</p>
                        )}
                        {n.createdBy && (
                          <p className="mt-1 text-[11px] opacity-70">By: {n.createdBy}</p>
                        )}

                        {/* --- Replies: one level deep, oldest first.
                            The rule tracks currentColor so it reads correctly
                            on both plain and open-issue cards, in either
                            theme — a `dark:` variant would follow the OS
                            preference instead of the app's own theme. --- */}
                        {(n.replies?.length ?? 0) > 0 && (
                          <div className="mt-2 space-y-2 border-l-2 border-current/25 pl-2.5">
                            {n.replies?.map((r) => (
                              <div key={r.id} className="text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 whitespace-pre-wrap break-words">
                                    {r.content}
                                  </p>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDeleteReply(n.id, r.id)}
                                      className="shrink-0 text-text-muted hover:text-issue"
                                      aria-label="Delete reply"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] opacity-70">
                                  {r.createdBy || 'Guest'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {replyingToId === n.id ? (
                          <div className="mt-2 space-y-1.5">
                            {!isAdmin && (
                              <input
                                value={guestName}
                                onChange={(e) => {
                                  setGuestName(e.target.value);
                                  if (replyError) setReplyError(null);
                                }}
                                placeholder="Your name *"
                                aria-label="Your name"
                                className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-text outline-none focus:border-primary"
                              />
                            )}
                            <textarea
                              value={replyDraft}
                              onChange={(e) => setReplyDraft(e.target.value)}
                              placeholder="Write a reply..."
                              aria-label="Reply"
                              rows={2}
                              className="w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleSendReply(n)}
                                disabled={sendingReply || !replyDraft.trim()}
                                className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                              >
                                Send
                              </button>
                              <button
                                onClick={() => setReplyingToId(null)}
                                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg"
                              >
                                Cancel
                              </button>
                              {replyError && (
                                <span className="text-[11px] text-issue">{replyError}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startReply(n)}
                            className="mt-2 text-xs font-medium text-text-muted hover:text-primary"
                          >
                            Reply
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border p-4">
          {error && <p className="mb-2 text-xs text-issue">{error}</p>}
          <div className="mb-2 flex gap-2">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(['note', 'issue'] as NoteType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-md px-2.5 py-1 font-medium capitalize ${
                    type === t ? 'bg-primary text-white' : 'text-text-muted'
                  }`}
                >
                  {t === 'note' ? 'Note' : 'Issue'}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-bg px-2 py-1 text-xs text-text"
            />
          </div>
          {!isAdmin && (
            <div className="mb-2">
              <input
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Your name *"
                aria-label="Your name"
                aria-invalid={!!nameError}
                className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary ${
                  nameError ? 'border-issue' : 'border-border'
                }`}
              />
              {nameError && <p className="mt-1 text-xs text-issue">{nameError}</p>}
            </div>
          )}
          {isAdmin && (
            <div className="mb-2">
              <input
                value={evidenceUrl}
                onChange={(e) => {
                  setEvidenceUrl(e.target.value);
                  if (evidenceError) setEvidenceError(null);
                }}
                placeholder="Evidence link (optional) — e.g. https://drive.google.com/..."
                aria-label="Evidence link"
                aria-invalid={!!evidenceError && editingEvidenceId === null}
                className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary ${
                  evidenceError && editingEvidenceId === null ? 'border-issue' : 'border-border'
                }`}
              />
              {evidenceError && editingEvidenceId === null && (
                <p className="mt-1 text-xs text-issue">{evidenceError}</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a note or issue..."
              rows={2}
              className="flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
