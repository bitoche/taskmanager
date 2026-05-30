import React from 'react';
import { Task } from '../types';

interface Props {
  date: Date;
  tasks: Task[];
  isToday: boolean;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: number, newDueDate: string) => void;
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

const DayCard: React.FC<Props> = ({ date, tasks, isToday, onAddTask, onEditTask, onMoveTask, dateStr }) => {
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
        <div className="month-hint">{date.toLocaleString('ru-RU', { month: 'long' })}</div>
      </div>
      <div className="tasks-list">
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa' }}>—</div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.task_id}
              className="task-item"
              draggable
              onDragStart={(e) => handleDragStart(e, task.task_id)}
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
            >
              <div className="task-title">{escapeHtml(task.title)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DayCard;