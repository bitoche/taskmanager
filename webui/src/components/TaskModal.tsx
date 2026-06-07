import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskComment, TaskTag } from '../types';
import { fetchTaskComments, addTaskComment, deleteTaskComment } from '../api';
import { X, Send, Trash2, Plus, Tag, MessageSquare, FileText, ExternalLink, Calendar, Check, /*ChevronDown*/ } from 'lucide-react';
import './TaskModal.css';

interface Props {
  isOpen: boolean;
  task?: Task;
  defaultDate?: string;
  onSave: (taskData: Omit<Task, 'task_id'>) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  allTags: TaskTag[];
  taskTags: TaskTag[];
  onAssignTag: (tagId: number) => void;
  onRemoveTag: (tagId: number) => void;
  onCreateTag: (tagText: string, tagColor: string) => Promise<void>;
}

const TaskModal: React.FC<Props> = ({
  isOpen, task, defaultDate, onSave, onDelete, onClose,
  allTags, taskTags, onAssignTag, onRemoveTag, onCreateTag
}) => {
  // Основные поля
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [link, setLink] = useState('');

  // Комментарии
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Теги
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#ff0000');
  const [creatingTag, setCreatingTag] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const tagSelectorRef = useRef<HTMLDivElement>(null);

  // Загрузка комментариев при открытии для существующей задачи
  useEffect(() => {
    if (isOpen && task) {
      fetchTaskComments(task.task_id).then(setComments).catch(console.error);
    }
  }, [isOpen, task]);

  // Заполнение формы при редактировании или создании
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
      setLink(task.link_to_taskmanager || '');
    } else {
      setTitle('');
      setDescription('');
      setDueDate(defaultDate || '');
      setLink('');
    }
  }, [task, defaultDate]);

  // Закрытие селектора тегов при клике вне его области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setShowTagSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESC для закрытия модалки
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

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
    onClose();
  };

  const handleAddComment = async () => {
    if (!task || !newCommentText.trim()) return;
    setAddingComment(true);
    try {
      await addTaskComment(task.task_id, newCommentText.trim());
      const updated = await fetchTaskComments(task.task_id);
      setComments(updated);
      setNewCommentText('');
    } catch (err) {
      console.error(err);
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm('Удалить комментарий?')) {
      try {
        await deleteTaskComment(commentId);
        if (task) setComments(await fetchTaskComments(task.task_id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateTag = async () => {
    if (!newTagText.trim()) return;
    setCreatingTag(true);
    try {
      await onCreateTag(newTagText.trim(), newTagColor);
      setNewTagText('');
      setNewTagColor('#e0e0e0');
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingTag(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal-container" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h3>{task ? 'Редактирование задачи' : 'Новая задача'}</h3>
          <button className="task-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-modal-form">
          <div className="task-modal-body">
            {/* Блок основной информации */}
            <div className="form-section">
              <div className="section-title">
                <FileText size={18} />
                <span>Основная информация</span>
              </div>
              <div className="form-group">
                <label>Название <span className="required">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Купить молоко"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Подробности задачи..."
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Дата выполнения</label>
                  <div className="input-icon">
                    <Calendar size={16} />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Ссылка</label>
                  <div className="input-icon">
                    <ExternalLink size={16} />
                    <input
                      type="text"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Блок тегов */}
            <div className="form-section">
              <div className="section-title">
                <Tag size={18} />
                <span>Теги</span>
              </div>
              <div className="tags-section">
                <div className="current-tags">
                  {taskTags.length === 0 ? (
                    <div className="empty-hint">Нет тегов</div>
                  ) : (
                    taskTags.map(tag => (
                      <div key={tag.task_tag_id} className="tag-chip" style={{ backgroundColor: tag.tag_color }}>
                        {tag.tag_text}
                        <button
                          type="button"
                          className="tag-remove"
                          onClick={() => onRemoveTag(tag.task_tag_id)}
                          title="Удалить тег"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="tag-selector-wrapper" ref={tagSelectorRef}>
                  <button
                    type="button"
                    className="add-tag-btn"
                    onClick={() => setShowTagSelector(!showTagSelector)}
                  >
                    <Plus size={14} /> Добавить тег
                  </button>
                  {showTagSelector && (
                    <div className="tag-selector-dropdown">
                      <div className="tag-list-select">
                        {allTags.filter(t => !taskTags.some(tt => tt.task_tag_id === t.task_tag_id)).map(tag => (
                          <div
                            key={tag.task_tag_id}
                            className="tag-option"
                            onClick={() => {
                              onAssignTag(tag.task_tag_id);
                              setShowTagSelector(false);
                            }}
                          >
                            <span className="tag-color-dot" style={{ backgroundColor: tag.tag_color }} />
                            {tag.tag_text}
                          </div>
                        ))}
                        {allTags.filter(t => !taskTags.some(tt => tt.task_tag_id === t.task_tag_id)).length === 0 && (
                          <div className="no-tags-msg">Все теги уже добавлены</div>
                        )}
                      </div>
                      <div className="new-tag-row">
                        <input
                          type="text"
                          placeholder="Новый тег"
                          value={newTagText}
                          onChange={(e) => setNewTagText(e.target.value)}
                        />
                        <input
                          type="color"
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          title="Цвет тега"
                        />
                        <button type="button" onClick={handleCreateTag} disabled={creatingTag}>
                          {creatingTag ? '...' : 'Создать'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Блок комментариев (только для существующей задачи) */}
            {task && (
              <div className="form-section">
                <div className="section-title">
                  <MessageSquare size={18} />
                  <span>Комментарии ({comments.length})</span>
                </div>
                <div className="comments-section">
                  <div className="comments-list">
                    {comments.length === 0 ? (
                      <div className="empty-hint">Нет комментариев</div>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.comment_id} className="comment-item">
                          <div className="comment-text">{comment.text}</div>
                          <div className="comment-meta">
                            <span>{new Date(comment.created_at).toLocaleString()}</span>
                            <button
                              type="button"
                              className="delete-comment-btn"
                              onClick={() => handleDeleteComment(comment.comment_id)}
                              title="Удалить комментарий"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="new-comment">
                    <textarea
                      rows={2}
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Напишите комментарий..."
                    />
                    <button
                      type="button"
                      className="send-comment-btn"
                      onClick={handleAddComment}
                      disabled={addingComment || !newCommentText.trim()}
                    >
                      <Send size={14} /> Отправить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="task-modal-footer">
            {task && (
              <button type="button" className="btn-danger" onClick={onDelete}>
                <Trash2 size={16} /> Удалить
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              <Check size={16} /> Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;