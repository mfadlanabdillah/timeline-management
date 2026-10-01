import { inv, sessionToken } from './tauri-client';

export type ExportFormat = 'xlsx' | 'pdf';

/**
 * Rust builds the report and shows a native save dialog.
 * Resolves to the saved path, or null if the user cancelled.
 */
export function downloadProjectExport(
  projectId: string,
  format: ExportFormat,
  code?: string,
): Promise<string | null> {
  return inv<string | null>('export_project', {
    project_id: projectId,
    format,
    code,
    token: sessionToken() ?? undefined,
  });
}
