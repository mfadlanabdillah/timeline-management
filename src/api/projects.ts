import { inv, sessionToken } from './tauri-client';
import type { Project } from '../types';

const token = () => sessionToken() ?? undefined;

export function listProjects() {
  return inv<Project[]>('list_projects', { token: token() });
}

export function getProjectByCode(code: string) {
  return inv<Project>('get_project_by_code', { code, token: token() });
}

export function createProject(data: { name: string; code: string }) {
  return inv<Project>('create_project', { ...data, token: token() });
}

export function updateProject(id: string, data: Partial<{ name: string; code: string }>) {
  return inv<Project>('update_project', { id, ...data, token: token() });
}

export function deleteProject(id: string) {
  return inv<void>('delete_project', { id, token: token() });
}
