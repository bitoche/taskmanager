import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import './TaskList.css';

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: number, newStatus: number) => void;
}

type SortField = 'title' | 'due_date' | 'task_status' | 'created_at';
type SortOrder = 'asc' | 'desc';

const TaskList: React.FC<Props> = ({ tasks, onTaskClick, onToggleStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Фильтрация
  const filteredTasks = useMemo(() => {
    if (!searchTerm.trim()) return tasks;
    const lowerTerm = searchTerm.toLowerCase();
    return tasks.filter(task =>
      task.title.toLowerCase().includes(lowerTerm) ||
      (task.description?.toLowerCase().includes(lowerTerm)) ||
      (task.link_to_taskmanager?.toLowerCase().includes(lowerTerm))
    );
  }, [tasks, searchTerm]);

  // Сортировка
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case 'title':
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case 'due_date':
          valA = a.due_date || '';
          valB = b.due_date || '';
          break;
        case 'task_status':
          valA = a.task_status ?? 0;
          valB = b.task_status ?? 0;
          break;
        case 'created_at':
          valA = a.created_at || '';
          valB = b.created_at || '';
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredTasks, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleStatusToggle = (e: React.MouseEvent, taskId: number, currentStatus: number) => {
    e.stopPropagation();
    const newStatus = currentStatus === 2 ? 1 : 2;
    onToggleStatus(taskId, newStatus);
  };

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <h3>Список задач</h3>
        <div className="task-list-search">
          <input
            type="text"
            placeholder="Поиск по названию, описанию, ссылке..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="task-list-table-wrapper">
        <table className="task-list-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('title')}>Название {getSortIcon('title')}</th>
              <th onClick={() => handleSort('due_date')}>Дата {getSortIcon('due_date')}</th>
              <th onClick={() => handleSort('task_status')}>Статус {getSortIcon('task_status')}</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="no-tasks">Задачи не найдены</td>
              </tr>
            ) : (
              sortedTasks.map(task => {
                const isCompleted = task.task_status === 2;
                const overdue = task.due_date && !isCompleted
                  ? (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const parts = task.due_date!.split('-');
                      const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                      const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                      return diffDays > 0 ? diffDays : 0;
                    })()
                  : 0;
                return (
                  <tr
                    key={task.task_id}
                    className={`task-row ${isCompleted ? 'completed-row' : ''}`}
                    onClick={() => onTaskClick(task)}
                  >
                    <td className="task-title-cell">{task.title}</td>
                    <td className="task-date-cell">
                      {task.due_date || '—'}
                      {overdue > 0 && <span className="overdue-badge-list">просрочка {overdue} дн.</span>}
                    </td>
                    <td className="task-status-cell">
                      {isCompleted ? '🔴 Выполнена' : '🟢 Активна'}
                    </td>
                    <td className="task-action-cell">
                      <button
                        className="status-toggle-btn-list"
                        onClick={(e) => handleStatusToggle(e, task.task_id, task.task_status || 1)}
                        title={isCompleted ? "Отметить как невыполненную" : "Отметить как выполненную"}
                      >
                        {isCompleted ? '✅' : '⬜'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskList;