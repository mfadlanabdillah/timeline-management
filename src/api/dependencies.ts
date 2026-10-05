import { inv, sessionToken } from './tauri-client';
import type { ItemDependency } from '../types';

/** Admin-only; guests receive dependencies inside the by-code project payload. */
export function listDependencies(projectId: string) {
  return inv<ItemDependency[]>('list_dependencies', {
    project_id: projectId,
    token: sessionToken() ?? undefined,
  });
}

export function createDependency(data: { predecessorId: string; successorId: string }) {
  return inv<ItemDependency>('create_dependency', {
    predecessor_id: data.predecessorId,
    successor_id: data.successorId,
    token: sessionToken() ?? undefined,
  });
}

export function deleteDependency(id: string) {
  return inv<void>('delete_dependency', { id, token: sessionToken() ?? undefined });
}
