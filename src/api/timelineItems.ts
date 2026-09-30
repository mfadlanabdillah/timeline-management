import { inv, sessionToken } from './tauri-client';
import type { TimelineItem } from '../types';

const token = () => sessionToken() ?? undefined;

export function listTimelineItems(projectId: string) {
  return inv<TimelineItem[]>('list_timeline_items', { project_id: projectId, token: token() });
}

export function createTimelineItem(data: {
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  color?: string;
  isMilestone?: boolean;
}) {
  return inv<TimelineItem>('create_timeline_item', {
    project_id: data.projectId,
    name: data.name,
    start_date: data.startDate,
    end_date: data.endDate,
    color: data.color,
    is_milestone: data.isMilestone,
    token: token(),
  });
}

export function updateTimelineItem(
  id: string,
  data: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    color: string;
    position: number;
    isMilestone: boolean;
  }>,
) {
  return inv<TimelineItem>('update_timeline_item', {
    id,
    name: data.name,
    start_date: data.startDate,
    end_date: data.endDate,
    color: data.color,
    position: data.position,
    is_milestone: data.isMilestone,
    token: token(),
  });
}

export function deleteTimelineItem(id: string) {
  return inv<void>('delete_timeline_item', { id, token: token() });
}
