import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProjectByCode, listProjects } from '../api/projects';
import {
  createTimelineItem,
  deleteTimelineItem,
  updateTimelineItem,
} from '../api/timelineItems';
import { useAuth } from '../context/AuthContext';
import { ActivityLogModal } from '../components/ActivityLogModal';
import { AuroraBackground } from '../components/AuroraBackground';
import { ExportMenu } from '../components/ExportMenu';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { ItemForm } from '../components/ItemForm';
import { ThemeToggle } from '../components/ThemeToggle';
import { TimelineGrid } from '../components/Timeline/TimelineGrid';
import type { Project, TimelineItem } from '../types';

export function AdminProjectView() {
  const { id } = useParams<{ id: string }>();
  const { username } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<TimelineItem | null>(null);
  const [editingItem, setEditingItem] = useState<TimelineItem | null | undefined>(undefined);
  const [showActivity, setShowActivity] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const all = await listProjects();
    const found = all.find((p) => p.id === id) ?? null;
    if (found) {
      const full = await getProjectByCode(found.code);
      setProject(full);
    } else {
      setProject(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDatesChange(itemId: string, startDate: string, endDate: string) {
    if (!project) return;
    setProject({
      ...project,
      items: project.items?.map((it) =>
        it.id === itemId ? { ...it, startDate, endDate } : it,
      ),
    });
    await updateTimelineItem(itemId, { startDate, endDate });
  }

  async function handleReorder(orderedIds: string[]) {
    if (!project?.items) return;
    const byId = new Map(project.items.map((it) => [it.id, it]));
    const reordered = orderedIds
      .map((id, index) => {
        const item = byId.get(id);
        return item ? { ...item, position: index } : null;
      })
      .filter((it): it is TimelineItem => it !== null);
    // Optimistic UI update so the order sticks immediately.
    setProject({ ...project, items: reordered });
    // Persist only the items whose position actually changed.
    await Promise.all(
      reordered
        .filter((it) => byId.get(it.id)!.position !== it.position)
        .map((it) => updateTimelineItem(it.id, { position: it.position })),
    );
  }

  async function handleItemSubmit(data: {
    id?: string;
    name: string;
    startDate: string;
    endDate: string;
    color: string;
    isMilestone: boolean;
  }) {
    if (!project) return;
    // The API rejects unknown properties (forbidNonWhitelisted), so `id`
    // must not be part of the PATCH/POST body — it only goes in the URL.
    const { id, ...payload } = data;
    if (id) {
      await updateTimelineItem(id, payload);
    } else {
      await createTimelineItem({ ...payload, projectId: project.id });
    }
    await load();
  }

  async function handleDeleteItem(item: TimelineItem) {
    if (!confirm(`Delete item "${item.name}"? All related notes/issues will also be removed.`)) return;
    await deleteTimelineItem(item.id);
    setActiveItem(null);
    await load();
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg">
        <AuroraBackground />
        <p className="animate-pulse-soft relative z-10 text-sm text-text-muted">Loading…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-4 text-center">
        <AuroraBackground />
        <div className="glass animate-scale-in relative z-10 rounded-3xl px-10 py-9">
          <p className="text-text">Project not found.</p>
          <Link
            to="/admin"
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Back to dashboard
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
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-primary"
            >
              <span aria-hidden="true">←</span> All projects
            </Link>
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
            <ExportMenu projectId={project.id} />
            <button
              onClick={() => setShowActivity(true)}
              className="lift rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:border-primary/40 hover:text-primary"
            >
              Activity
            </button>
            <ThemeToggle />
            <button
              onClick={() => setEditingItem(null)}
              className="lift bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25"
            >
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M7.5 3v9M3 7.5h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Item
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1 p-4">
        <TimelineGrid
          items={project.items ?? []}
          canEdit
          dependencies={project.dependencies ?? []}
          onOpenItem={setActiveItem}
          onDatesChange={handleDatesChange}
          onReorder={handleReorder}
        />
      </div>
      {activeItem && (
        <ItemDetailModal
          item={activeItem}
          isAdmin
          currentUserLabel={username ?? 'admin'}
          allItems={project.items ?? []}
          dependencies={project.dependencies ?? []}
          onDependenciesChange={load}
          onClose={() => {
            setActiveItem(null);
            load();
          }}
          onEditItem={(item) => {
            setActiveItem(null);
            setEditingItem(item);
          }}
          onDeleteItem={handleDeleteItem}
        />
      )}
      {showActivity && (
        <ActivityLogModal projectId={project.id} onClose={() => setShowActivity(false)} />
      )}
      {editingItem !== undefined && (
        <ItemForm
          projectId={project.id}
          initial={editingItem}
          onClose={() => setEditingItem(undefined)}
          onSubmit={handleItemSubmit}
        />
      )}
    </div>
  );
}
