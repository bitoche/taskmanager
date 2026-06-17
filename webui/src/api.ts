import { Task, CreateTaskDTO, UpdateTaskDTO, TaskComment, TaskTag, TaskTagXTask } from './types';

const API_BASE = '/api';

function normalizeDate(date?: string | null): string | undefined {
  if (!date) return undefined;
  const tIndex = date.indexOf('T');
  if (tIndex !== -1) return date.slice(0, tIndex);
  return date;
}

export async function fetchTasksRange(dateFrom: string, dateTo: string): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks?date_from=${dateFrom}&date_to=${dateTo}`);
  if (!res.ok) throw new Error('Failed to fetch tasks range');
  const text = await res.text();
  const sanitized = text.replace(/:\s*NaN\b/gi, ': null');
  const tasks: Task[] = JSON.parse(sanitized);
  return tasks.map(task => ({
    ...task,
    description: task.description === undefined ? null : task.description,
    link_to_taskmanager: task.link_to_taskmanager === undefined ? null : task.link_to_taskmanager,
    due_date: task.due_date ? task.due_date.slice(0, 10) : null,
  }));
}

export async function createTask(task: CreateTaskDTO): Promise<void> {
  const payload = {
    ...task,
    due_date: normalizeDate(task.due_date),
  };
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create task');
}

export async function updateTask(taskId: number, task: UpdateTaskDTO): Promise<void> {
  const { task_id, ...body } = task;
  const payload = {
    ...body,
    due_date: normalizeDate(body.due_date),
  };
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update task');
}

export async function deleteTask(taskId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}

// Новые эндпоинты синхронизации
export async function syncDownload(): Promise<void> {
  const res = await fetch(`${API_BASE}/remote_db/sync_download`);
  if (!res.ok) throw new Error('Sync download failed');
}

export async function syncUpload(): Promise<void> {
  const res = await fetch(`${API_BASE}/remote_db/sync_upload`);
  if (!res.ok) throw new Error('Sync upload failed');
}

export async function checkRemoteUpdates(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/remote_db/check_updates`);
  if (!res.ok) throw new Error('Failed to check updates');
  const data = await res.json();
  return data.updates === true;
}

// ========== Комментарии ==========
export async function fetchTaskComments(taskId: number): Promise<TaskComment[]> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/comments`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

export async function addTaskComment(taskId: number, text: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, text }),
  });
  if (!res.ok) throw new Error('Failed to add comment');
}

export async function deleteTaskComment(commentId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/comment/delete/${commentId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete comment');
}

// ========== Теги ==========
export async function fetchAllTags(): Promise<TaskTag[]> {
  const res = await fetch(`${API_BASE}/task_tags`);
  if (!res.ok) throw new Error('Failed to fetch tags');
  return res.json();
}

export async function fetchTaskTagsXTask(): Promise<TaskTagXTask[]> {
  const res = await fetch(`${API_BASE}/task_tags/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tag assignments');
  return res.json();
}

export async function createTag(tagText: string, tagColor: string): Promise<void> {
  const res = await fetch(`${API_BASE}/task_tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_text: tagText, tag_color: tagColor }),
  });
  if (!res.ok) throw new Error('Failed to create tag');
}

export async function assignTagToTask(taskTagId: number, taskId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/task_tags/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_tag_id: taskTagId, task_id: taskId }),
  });
  if (!res.ok) throw new Error('Failed to assign tag');
}

export async function unassignTagFromTask(taskTagId: number, taskId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/task_tags/unassign/${taskTagId}/task/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to unassign tag');
}

// ВНИМАНИЕ: следующий эндпоинт должен быть добавлен в бэкенд (app/api.py)
export async function deleteTagGlobally(taskTagId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/task_tags/${taskTagId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete tag');
}

// Добавить после остальных функций для тегов
export async function updateTag(tagId: number, tagText: string, tagColor: string): Promise<void> {
  const res = await fetch(`${API_BASE}/task_tags/${tagId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_text: tagText, tag_color: tagColor }),
  });
  if (!res.ok) throw new Error('Failed to update tag');
}
