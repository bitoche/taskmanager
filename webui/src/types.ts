export interface Task {
  task_id: number;
  title: string;
  description?: string | null ;
  link_to_taskmanager?: string | null;
  due_date?: string | null;        // YYYY-MM-DD
  closed_dttm?: string | null;     // ISO datetime закрытия
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

// Комментарии
export interface TaskComment {
  comment_id: number;
  task_id: number;
  text: string;
  created_at: string; // ISO datetime
}

export interface CreateTaskCommentDTO {
  task_id: number;
  text: string;
}

// Теги
export interface TaskTag {
  task_tag_id: number;
  tag_color: string;   // цвет в HEX или название
  tag_text: string;
}

export interface TaskTagXTask {
  task_tag_id: number;
  task_id: number;
}

export interface CreateTaskTagDTO {
  tag_color: string;
  tag_text: string;
}

export interface CreateTaskTagXTaskDTO {
  task_tag_id: number;
  task_id: number;
}