export type ExportFormat = 'xlsx' | 'pdf';

// ponytail: MVP stub — export XLSX/PDF (rust_xlsxwriter + printpdf) hadir setelah MVP.
// Tanda tangan dipertahankan agar ExportMenu tidak berubah.
export async function downloadProjectExport(
  _projectId: string,
  _format: ExportFormat,
  _code?: string,
): Promise<void> {
  throw new Error('Export XLSX/PDF belum tersedia di versi desktop ini.');
}
