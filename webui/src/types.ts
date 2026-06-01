export interface Task {
  task_id: number;
  title: string;
  description?: string | null ;
  link_to_taskmanager?: string | null;
  due_date?: string | null;        // YYYY-MM-DD
  created_at?: string;             // ISO datetime
  task_status?: number | null;
}

export interface CreateTaskDTO {
  title: string;
  description?: string | null;
  link_to_taskmanager?: string | null;
  due_date?: string;
  task_status?: number | null;
}

export interface UpdateTaskDTO {
  task_id: number;
  title?: string | null;
  description?: string | null;
  link_to_taskmanager?: string | null;
  due_date?: string | null;
  task_status?: number | null;
}