import { inv, sessionToken } from './tauri-client';
import type { AuditLogEntry } from '../types';

export interface AuditPage {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** Admin only. */
export function listAuditLogs(params: { projectId?: string; limit?: number; offset?: number }) {
  return inv<AuditPage>('list_audit_logs', {
    project_id: params.projectId,
    limit: params.limit,
    offset: params.offset,
    token: sessionToken() ?? undefined,
  });
}
