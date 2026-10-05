import type { ItemDependency, TimelineItem } from '../../types';
import { diffDays, parseDate } from './dateUtils';

/**
 * Critical Path Method over the finish-to-start dependency graph.
 * Durations come from each item's own dates; items with zero slack sit on the
 * critical path, so any delay there pushes the whole chain out.
 */
export function computeCriticalPath(
  items: TimelineItem[],
  dependencies: ItemDependency[],
): Set<string> {
  if (items.length === 0 || dependencies.length === 0) return new Set();

  const byId = new Map(items.map((i) => [i.id, i]));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();

  for (const dep of dependencies) {
    if (!byId.has(dep.predecessorId) || !byId.has(dep.successorId)) continue;
    preds.set(dep.successorId, [...(preds.get(dep.successorId) ?? []), dep.predecessorId]);
    succs.set(dep.predecessorId, [...(succs.get(dep.predecessorId) ?? []), dep.successorId]);
  }

  const duration = (id: string) => {
    const item = byId.get(id);
    if (!item) return 0;
    if (item.isMilestone) return 0;
    return diffDays(parseDate(item.startDate), parseDate(item.endDate)) + 1;
  };

  const order = topologicalOrder(items.map((i) => i.id), succs, preds);
  if (!order) return new Set(); // cycle guard; the API prevents these

  // Forward pass: earliest start / finish.
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const start = Math.max(0, ...(preds.get(id) ?? []).map((p) => ef.get(p) ?? 0));
    es.set(id, start);
    ef.set(id, start + duration(id));
  }

  const projectFinish = Math.max(0, ...order.map((id) => ef.get(id) ?? 0));

  // Backward pass: latest start / finish.
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const successors = succs.get(id) ?? [];
    const finish =
      successors.length === 0
        ? projectFinish
        : Math.min(...successors.map((s) => ls.get(s) ?? projectFinish));
    lf.set(id, finish);
    ls.set(id, finish - duration(id));
  }

  const critical = new Set<string>();
  for (const id of order) {
    // Only items that actually participate in a chain can be critical.
    const linked = (preds.get(id)?.length ?? 0) + (succs.get(id)?.length ?? 0) > 0;
    if (linked && (ls.get(id) ?? 0) - (es.get(id) ?? 0) === 0) critical.add(id);
  }
  return critical;
}

/** Kahn's algorithm; returns null when the graph contains a cycle. */
function topologicalOrder(
  ids: string[],
  succs: Map<string, string[]>,
  preds: Map<string, string[]>,
): string[] | null {
  const indegree = new Map(ids.map((id) => [id, preds.get(id)?.length ?? 0]));
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of succs.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  return order.length === ids.length ? order : null;
}
