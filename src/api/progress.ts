import { inv, sessionToken } from './tauri-client';
import type { ProgressEntry } from '../types';

const token = () => sessionToken() ?? undefined;

/** `code` is required for guests; admins are authorised by their token. */
export function listProgress(itemId: string, code?: string) {
  return inv<ProgressEntry[]>('list_progress', { item_id: itemId, code, token: token() });
}

export function upsertProgress(data: { itemId: string; date: string; percentage: number }) {
  return inv<ProgressEntry>('upsert_progress', {
    item_id: data.itemId,
    date: data.date,
    percentage: data.percentage,
    token: token(),
  });
}

export function deleteProgress(id: string) {
  return inv<void>('delete_progress', { id, token: token() });
}
