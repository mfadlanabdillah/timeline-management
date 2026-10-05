import { useState } from 'react';
import type { Project } from '../types';

interface ProjectFormProps {
  initial?: Project | null;
  onClose: () => void;
  onSubmit: (data: { id?: string; name: string; code: string }) => Promise<void>;
}

export function ProjectForm({ initial, onClose, onSubmit }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ id: initial?.id, name: name.trim(), code: code.trim().toUpperCase() });
      onClose();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof message === 'string' ? message : 'Failed to save project');
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
        className="glass animate-scale-in w-full max-w-sm rounded-2xl p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-text">
          {initial ? 'Edit Project' : 'New Project'}
        </h2>
        {error && <p className="mb-3 text-sm text-issue">{error}</p>}
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-text-muted">Project name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            placeholder="e.g. Website Redesign"
          />
        </label>
        <label className="mb-5 block text-sm">
          <span className="mb-1 block font-medium text-text-muted">Project code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 uppercase text-text outline-none focus:border-primary"
            placeholder="e.g. WEB2026"
          />
          <span className="mt-1 block text-xs text-text-muted">
            Guests use this code to access the timeline without signing in.
          </span>
        </label>
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
