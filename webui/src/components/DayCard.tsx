import React from 'react';
import { Task } from '../types';

interface Props {
  date: Date;
  tasks: Task[];
  isToday: boolean;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: number, newDueDate: string) => void;
  onToggleStatus: (taskId: number, currentStatus: number) => void;
  dateStr: string;
}

function formatDisplayDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('ru-RU', { month: 'short' }).replace('.', '');
  return `${day} ${month}`;
}

function formatWeekday(date: Date): string {
  let wd = date.toLocaleString('ru-RU', { weekday: 'short' });
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function getOverdueDays(dueDateStr: string | null | undefined): number {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dueDateStr.split('-');
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

const DayCard: React.FC<Props> = ({ 
  date, tasks, isToday, onAddTask, onEditTask, onMoveTask, onToggleStatus, dateStr 
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.task-item')) return;
    onAddTask();
  };

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(taskId)) {
      onMoveTask(taskId, dateStr);
    }
  };

  const handleStatusToggle = (e: React.MouseEvent, taskId: number, currentStatus: number) => {
    e.stopPropagation();
    const newStatus = currentStatus === 2 ? 1 : 2;
    onToggleStatus(taskId, newStatus);
  };

  const handleOpenLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (url) {
      // Если ссылка не начинается с http, добавляем https://
      window.open('https://' + url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`day-card ${isToday ? 'today-card' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleCardClick}
      data-date={dateStr}
    >
      <div className="day-header">
        <div className="date">{formatDisplayDate(date)}</div>
        <div className="weekday">{formatWeekday(date)}</div>
        <div hidden className="month-hint">{date.toLocaleString('ru-RU', { month: 'long' })}</div>
      </div>
      <div className="tasks-list">
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa' }}>—</div>
        ) : (
          tasks.map((task) => {
            const overdue = getOverdueDays(task.due_date);
            const isCompleted = task.task_status === 2;
            const isActive = task.task_status === 1;
            const hasLink = task.link_to_taskmanager && task.link_to_taskmanager.trim() !== '';

            let badge = null;
            if (isActive && overdue > 0) {
              let title_badge = 'Дней просрочки: ' + overdue;
              badge = <span title={title_badge} className="overdue-badge">{overdue}⟳</span>;
            }

            return (
              <div
                key={task.task_id}
                className={`task-item ${isCompleted ? 'completed-task' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, task.task_id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTask(task);
                }}
              >
                <div className="task-title">
                  {badge}
                  <span className="task-title-text">{escapeHtml(task.title)}</span>
                  <div className="task-actions">
                    <button
                      className="status-toggle-btn"
                      onClick={(e) => handleStatusToggle(e, task.task_id, task.task_status || 1)}
                      title={isCompleted ? "Отметить как невыполненную" : "Отметить как выполненную"}
                    >
                      {isCompleted ? '✅' : '⬜'}
                    </button>
                    {hasLink && (
                      <button
                        className="link-btn"
                        onClick={(e) => handleOpenLink(e, task.link_to_taskmanager!)}
                        title="Открыть во внешнем менеджере"
                      >
                        🔗
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DayCard;