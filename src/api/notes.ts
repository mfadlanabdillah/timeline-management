import { inv, sessionToken } from './tauri-client';
import type { Note, NoteReply, NoteType } from '../types';

const token = () => sessionToken() ?? undefined;

/** `code` is required for guests; admins are authorised by their token. */
export function listNotes(itemId: string, code?: string) {
  return inv<Note[]>('list_notes', { item_id: itemId, code, token: token() });
}

export function createNote(
  data: {
    itemId: string;
    date: string;
    content: string;
    type: NoteType;
    createdBy?: string;
    /** Admin only — the backend rejects this field from unauthenticated callers. */
    evidenceUrl?: string;
  },
  code?: string,
) {
  return inv<Note>('create_note', {
    item_id: data.itemId,
    date: data.date,
    content: data.content,
    note_type: data.type,
    created_by: data.createdBy,
    evidence_url: data.evidenceUrl,
    code,
    token: token(),
  });
}

/** Guests may reply by presenting the project code; admins by their token. */
export function createNoteReply(
  noteId: string,
  data: { content: string; createdBy?: string },
  code?: string,
) {
  return inv<NoteReply>('create_note_reply', {
    note_id: noteId,
    content: data.content,
    created_by: data.createdBy,
    code,
    token: token(),
  });
}

/** Admin only. */
export function deleteNoteReply(noteId: string, replyId: string) {
  return inv<void>('delete_note_reply', { note_id: noteId, reply_id: replyId, token: token() });
}

/** Admin only. Pass null to remove the existing link. */
export function setNoteEvidence(id: string, evidenceUrl: string | null) {
  return inv<Note>('set_note_evidence', { id, evidence_url: evidenceUrl, token: token() });
}

export function setNoteResolved(id: string, resolved: boolean) {
  return inv<Note>('set_note_resolved', { id, resolved, token: token() });
}

export function deleteNote(id: string) {
  return inv<void>('delete_note', { id, token: token() });
}
