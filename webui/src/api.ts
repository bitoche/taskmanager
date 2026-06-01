import { Task, CreateTaskDTO, UpdateTaskDTO } from './types';

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