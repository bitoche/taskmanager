import React, { useState, useEffect } from 'react';
import { Task } from '../types';

interface Props {
  isOpen: boolean;
  task?: Task;
  defaultDate?: string;
  onSave: (taskData: Omit<Task, 'task_id'>) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}

const TaskModal: React.FC<Props> = ({ isOpen, task, defaultDate, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(
        task.due_date
          ? task.due_date.slice(0, 10)
          : ''
      );
      setLink(task.link_to_taskmanager || '');
    } else {
      setTitle('');
      setDescription('');
      setDueDate(defaultDate || '');
      setLink('');
    }
  }, [task, defaultDate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Введите название задачи');
      return;
    }
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      link_to_taskmanager: link.trim() || null,
      due_date: dueDate || null,
      task_status: task?.task_status ?? null,
    });
  };

  const handleDelete = async () => {
    // if (window.confirm('Удалить задачу?')) {
      await onDelete();
    // }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{task ? 'Редактировать задачу' : 'Новая задача'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Купить молоко"
              required
            />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробности..."
              style={{
                resize: 'vertical',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            />
          </div>
          <div className="form-group">
            <label>Ссылка на внешний менеджер</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form-group">
            <label>Дата выполнения</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="modal-buttons">
            <button type="submit" className="primary">Сохранить</button>
            {task && (
              <button type="button" className="danger" onClick={handleDelete}>
                Удалить
              </button>
            )}
            <button type="button" onClick={onClose}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;