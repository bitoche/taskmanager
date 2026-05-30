import { Task, CreateTaskDTO, UpdateTaskDTO } from './types';

const API_BASE = '/api';

// Получить все задачи (без фильтра – пригодится для начальной загрузки)
export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

// Получить задачи за диапазон дат
export async function fetchTasksRange(dateFrom: string, dateTo: string): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks/between?date_from=${dateFrom}&date_to=${dateTo}`);
  if (!res.ok) throw new Error('Failed to fetch tasks range');
  const data = await res.json();
  console.log('Fetched tasks:', data); // для отладки
  return data;
}

// Создать задачу
export async function createTask(task: CreateTaskDTO): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to create task');
  // ответ: { "status": "success" }
}

// Обновить задачу
export async function updateTask(taskId: number, task: UpdateTaskDTO): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to update task');
}

// Удалить задачу
export async function deleteTask(taskId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}
