import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProjectByCode } from '../api/projects';
import { AuroraBackground } from '../components/AuroraBackground';
import { ExportMenu } from '../components/ExportMenu';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { TimelineGrid } from '../components/Timeline/TimelineGrid';
import type { Project, TimelineItem } from '../types';

export function GuestProjectView() {
  const { code } = useParams<{ code: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<TimelineItem | null>(null);

  const load = useCallback(() => {
    if (!code) return;
    setLoading(true);
    getProjectByCode(code)
      .then((p) => {
        setProject(p);
        setError(null);
      })
      .catch(() => setError('No project found for that code.'))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDatesChange() {
    // Guests cannot drag/resize (canEdit=false), no-op kept for prop shape.
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg">
        <AuroraBackground />
        <p className="animate-pulse-soft relative z-10 text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
        <AuroraBackground />
        <div className="glass animate-scale-in relative z-10 max-w-sm rounded-3xl px-8 py-9">
          <div className="bg-brand-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg shadow-primary/25">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 8v5M12 16.5v.5"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" opacity="0.6" />
            </svg>
          </div>
          <p className="mt-4 text-text">{error}</p>
          <Link
            to="/"
            className="lift mt-5 inline-block rounded-xl border border-border px-4 py-2 text-sm font-semibold text-primary hover:border-primary/40"
          >
            Try another code
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col bg-bg">
      <AuroraBackground />

      <header className="glass animate-fade-in relative z-20 border-x-0 border-t-0 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Shared timeline
            </span>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-text">
                {project.name}
              </h1>
              <span className="rounded-lg border border-border bg-surface/60 px-2 py-0.5 font-mono text-[11px] tracking-wider text-text-muted">
                {project.code}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu projectId={project.id} projectCode={project.code} />
            <ThemeToggle />
            <Link
              to="/"
              className="lift rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:border-primary/40 hover:text-primary"
            >
              Change project
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1 p-4">
        <TimelineGrid
          items={project.items ?? []}
          canEdit={false}
          dependencies={project.dependencies ?? []}
          onOpenItem={setActiveItem}
          onDatesChange={handleDatesChange}
        />
      </div>
      {activeItem && (
        <ItemDetailModal
          item={activeItem}
          isAdmin={false}
          currentUserLabel="Guest"
          projectCode={project.code}
          onClose={() => {
            setActiveItem(null);
            load();
          }}
        />
      )}
    </div>
  );
}
