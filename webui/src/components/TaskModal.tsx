import React, { useState, useEffect } from 'react';
import { Task } from '../types';

interface Props {
  isOpen: boolean;
  task?: Task;
  defaultDate?: string;
  onSave: (taskData: Omit<Task, 'id'>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

const TaskModal: React.FC<Props> = ({ isOpen, task, defaultDate, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(task.due_date || '');
    } else {
      setTitle('');
      setDescription('');
      setDueDate(defaultDate || '');
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
      due_date: dueDate || null,
      completed: task?.completed || false,
    });
  };

  const handleDelete = async () => {
    if (window.confirm('Удалить задачу?')) {
      await onDelete();
    }
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