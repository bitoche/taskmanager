export interface Task {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;   // YYYY-MM-DD
  completed?: boolean;
  overdue_days?: number;
}