import { useState } from 'react';
import { downloadProjectExport, type ExportFormat } from '../api/exports';

interface ExportMenuProps {
  projectId: string;
  /** Guests must present their project code. */
  projectCode?: string;
}

export function ExportMenu({ projectId, projectCode }: ExportMenuProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(format: ExportFormat) {
    setBusy(format);
    setError(null);
    try {
      await downloadProjectExport(projectId, format, projectCode);
    } catch {
      setError('Export failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {(['xlsx', 'pdf'] as ExportFormat[]).map((format) => (
        <button
          key={format}
          onClick={() => handleDownload(format)}
          disabled={busy !== null}
          title={`Download ${format.toUpperCase()} report`}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-primary disabled:opacity-50"
        >
          {busy === format ? '...' : format.toUpperCase()}
        </button>
      ))}
      {error && <span className="text-xs text-issue">{error}</span>}
    </div>
  );
}
