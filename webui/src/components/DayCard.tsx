import React from 'react';
import { Task } from '../types';

interface Props {
  date: Date;
  tasks: Task[];
  isToday: boolean;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
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

const DayCard: React.FC<Props> = ({ date, tasks, isToday, onAddTask, onEditTask }) => {
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.task-item')) return;
    onAddTask();
  };

  return (
    <div
      className={`day-card ${isToday ? 'today-card' : ''}`}
      onClick={handleCardClick}
      data-date={date.toISOString().slice(0, 10)}
    >
      <div className="day-header">
        <div className="date">{formatDisplayDate(date)}</div>
        <div className="weekday">{formatWeekday(date)}</div>
        <div className="month-hint">{date.toLocaleString('ru-RU', { month: 'long' })}</div>
      </div>
      <div className="tasks-list">
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa' }}>—</div>
        ) : (
          tasks.map((task) => {
            let badge = null;
            if (task.overdue_days && task.overdue_days > 0 && !task.completed) {
              badge = <span className="overdue-badge">просрочка {task.overdue_days} дн.</span>;
            } else if (task.completed) {
              badge = <span className="completed-badge">✓ выполнено</span>;
            }
            return (
              <div
                key={task.id}
                className="task-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTask(task);
                }}
              >
                <div className="task-title">
                  <span>
                    {escapeHtml(task.title)} {badge}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#555' }}>
                  {escapeHtml(task.description?.substring(0, 60))}
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