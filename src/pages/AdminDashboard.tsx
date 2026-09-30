import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createProject,
  deleteProject,
  getProjectByCode,
  listProjects,
  updateProject,
} from '../api/projects';
import { summarise } from '../components/Timeline/healthUtils';
import { useAuth } from '../context/AuthContext';
import { AuroraBackground } from '../components/AuroraBackground';
import { BrandMark } from '../components/BrandMark';
import { ProjectForm } from '../components/ProjectForm';
import { ThemeToggle } from '../components/ThemeToggle';
import { EmptyStateIllustration } from '../components/illustrations/EmptyStateIllustration';
import type { Project } from '../types';

export function AdminDashboard() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);

  // Cards show a health roll-up, which needs each project's items.
  const load = useCallback(() => {
    setLoading(true);
    listProjects()
      .then(async (list) => {
        const detailed = await Promise.all(
          list.map((p) => getProjectByCode(p.code).catch(() => p)),
        );
        setProjects(detailed);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Portfolio-wide roll-up across every project. */
  const portfolio = useMemo(() => {
    const allItems = projects.flatMap((p) => p.items ?? []);
    return summarise(allItems);
  }, [projects]);

  async function handleSubmit(data: { id?: string; name: string; code: string }) {
    if (data.id) {
      await updateProject(data.id, { name: data.name, code: data.code });
    } else {
      await createProject({ name: data.name, code: data.code });
    }
    load();
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Delete project "${project.name}"? All items & notes will also be removed.`)) return;
    await deleteProject(project.id);
    load();
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="relative min-h-screen bg-bg">
      <AuroraBackground />

      <header className="glass sticky top-0 z-20 border-x-0 border-t-0 px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandMark to="/admin" />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-text-muted sm:inline">
              Signed in as <span className="font-semibold text-text">{username}</span>
            </span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="lift rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:border-issue/40 hover:text-issue"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        {/* Hero + portfolio stats */}
        <section className="animate-fade-up mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-text">
                Your <span className="text-gradient">projects</span>
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {projects.length === 0
                  ? 'Create your first project to get started.'
                  : `${projects.length} project${projects.length > 1 ? 's' : ''} · ${portfolio.totalItems} timeline items`}
              </p>
            </div>
            <button
              onClick={() => setEditing(null)}
              className="lift bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M7.5 3v9M3 7.5h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New project
            </button>
          </div>

          {projects.length > 0 && (
            <div className="stagger mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Overall progress" value={`${portfolio.overallProgress}%`} accent />
              <StatTile label="Completed" value={portfolio.completed} tone="text-emerald-600 dark:text-emerald-400" />
              <StatTile label="At risk" value={portfolio.atRisk} tone="text-amber-600 dark:text-amber-400" />
              <StatTile label="Open issues" value={portfolio.openIssues} tone="text-issue" />
            </div>
          )}
        </section>

        {loading && <SkeletonGrid />}

        {!loading && projects.length === 0 && (
          <div className="glass animate-scale-in flex flex-col items-center rounded-3xl px-6 py-12 text-center">
            <EmptyStateIllustration className="w-56 max-w-full" />
            <h2 className="mt-5 text-lg font-semibold text-text">No projects yet</h2>
            <p className="mt-1 max-w-sm text-sm text-text-muted">
              A project holds your timeline items, notes and progress. Create one and share
              its code with your stakeholders.
            </p>
            <button
              onClick={() => setEditing(null)}
              className="lift bg-brand-gradient mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25"
            >
              Create your first project
            </button>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={() => setEditing(p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        )}
      </main>

      {editing !== undefined && (
        <ProjectForm
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  accent = false,
}: {
  label: string;
  value: string | number;
  tone?: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-2xl px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${accent ? 'text-gradient' : (tone ?? 'text-text')}`}
      >
        {value}
      </p>
    </div>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const items = project.items ?? [];
  const s = summarise(items);

  return (
    <div className="glass lift group relative overflow-hidden rounded-2xl p-5 hover:shadow-xl">
      {/* accent wash that warms up on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
        style={{ background: 'radial-gradient(circle, var(--grad-b), transparent 70%)' }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-text" title={project.name}>
            {project.name}
          </h3>
          <span className="mt-1 inline-flex items-center rounded-lg border border-border bg-surface/60 px-2 py-0.5 font-mono text-[11px] tracking-wider text-text-muted">
            {project.code}
          </span>
        </div>
        <span className="shrink-0 text-xl font-semibold text-gradient">
          {s.overallProgress}%
        </span>
      </div>

      <div className="relative mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div
            className="bg-brand-gradient h-full rounded-full transition-[width] duration-700"
            style={{ width: `${s.overallProgress}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
          {items.length === 0 ? (
            <span>No items yet</span>
          ) : (
            <>
              <span>
                {s.completed}/{s.totalItems} done
              </span>
              {s.atRisk > 0 && (
                <span className="text-amber-600 dark:text-amber-400">{s.atRisk} at risk</span>
              )}
              {s.overdue > 0 && <span className="text-issue">{s.overdue} overdue</span>}
              {s.openIssues > 0 && (
                <span className="text-issue">
                  {s.openIssues} open issue{s.openIssues > 1 ? 's' : ''}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between border-t border-border/70 pt-3.5">
        <Link
          to={`/admin/projects/${project.id}`}
          className="text-sm font-semibold text-primary transition-transform duration-200 group-hover:translate-x-0.5"
        >
          Open timeline →
        </Link>
        <div className="flex gap-3 text-xs">
          <button onClick={onEdit} className="text-text-muted hover:text-primary">
            Edit
          </button>
          <button onClick={onDelete} className="text-text-muted hover:text-issue">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/** Placeholder cards so the layout doesn't jump while data loads. */
function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass rounded-2xl p-5">
          <div
            className="h-4 w-2/3 rounded bg-border"
            style={{
              backgroundImage:
                'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s linear infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
          <div className="mt-3 h-3 w-1/3 rounded bg-border" />
          <div className="mt-5 h-2 w-full rounded-full bg-border" />
          <div className="mt-5 h-3 w-1/2 rounded bg-border" />
        </div>
      ))}
    </div>
  );
}
