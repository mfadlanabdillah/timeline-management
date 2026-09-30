export interface Project {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  items?: TimelineItem[];
  dependencies?: ItemDependency[];
}

export interface TimelineItem {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  position: number;
  isMilestone: boolean;
  createdAt: string;
  notes?: Note[];
  progressEntries?: ProgressEntry[];
}

/** Finish-to-start link between two items in the same project. */
export interface ItemDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  createdAt: string;
}

export interface ProgressEntry {
  id: string;
  itemId: string;
  date: string;
  percentage: number;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'resolve' | 'reopen';
export type AuditEntityType =
  | 'project'
  | 'item'
  | 'note'
  | 'reply'
  | 'progress'
  | 'dependency';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  projectId: string | null;
  actor: string;
  actorType: 'admin' | 'guest';
  summary: string;
  createdAt: string;
}

export type NoteType = 'note' | 'issue';

/** A flat, one-level response to a note or issue. Replies are never nested. */
export interface NoteReply {
  id: string;
  noteId: string;
  content: string;
  createdBy?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  itemId: string;
  date: string;
  content: string;
  type: NoteType;
  createdBy?: string;
  /** Link to supporting evidence (e.g. Google Drive). Admin-set, readable by all. */
  evidenceUrl?: string | null;
  resolved: boolean;
  resolvedAt?: string | null;
  /** Oldest first, so a thread reads top to bottom. */
  replies?: NoteReply[];
  createdAt: string;
}
