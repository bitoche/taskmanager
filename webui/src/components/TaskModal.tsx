import React, { useState, useEffect } from 'react';
import { Task, TaskComment, TaskTag } from '../types';
import { fetchTaskComments, addTaskComment, deleteTaskComment } from '../api';
import { X, Send, Trash2, Plus, Tag, MessageSquare, FileText } from 'lucide-react';
// import TaskTags from './TaskTags';

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

type Tab = 'main' | 'tags' | 'comments';

const TaskModal: React.FC<Props> = ({ 
  isOpen, task, defaultDate, onSave, onDelete, onClose,
  allTags, taskTags, onAssignTag, onRemoveTag, onCreateTag
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('main');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [link, setLink] = useState('');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#e0e0e0');
  const [creatingTag, setCreatingTag] = useState(false);

  // Загрузка комментариев
  useEffect(() => {
    if (isOpen && task) {
      fetchTaskComments(task.task_id).then(setComments).catch(console.error);
    }
  }, [isOpen, task]);

  // Заполнение формы
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
    } catch (err) { console.error(err); }
    finally { setAddingComment(false); }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm('Удалить комментарий?')) {
      try {
        await deleteTaskComment(commentId);
        if (task) setComments(await fetchTaskComments(task.task_id));
      } catch (err) { console.error(err); }
    }
  };

  const handleCreateTag = async () => {
    if (!newTagText.trim()) return;
    setCreatingTag(true);
    try {
      await onCreateTag(newTagText.trim(), newTagColor);
      setNewTagText('');
      setNewTagColor('#e0e0e0');
    } catch (err) { console.error(err); }
    finally { setCreatingTag(false); }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{task ? 'Редактировать задачу' : 'Новая задача'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-tabs">
          <button className={`tab-btn ${activeTab === 'main' ? 'active' : ''}`} onClick={() => setActiveTab('main')}>
            <FileText size={16} /> Основное
          </button>
          <button className={`tab-btn ${activeTab === 'tags' ? 'active' : ''}`} onClick={() => setActiveTab('tags')}>
            <Tag size={16} /> Теги
          </button>
          {task && (
            <button className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
              <MessageSquare size={16} /> Комментарии ({comments.length})
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit}>
          {activeTab === 'main' && (
            <div className="tab-content">
              <div className="form-group">
                <label>Название *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Купить молоко" required />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Подробности..." />
              </div>
              <div className="form-group">
                <label>Ссылка на внешний менеджер</label>
                <input type="text" value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>Дата выполнения</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
          )}
          {activeTab === 'tags' && (
            <div className="tab-content">
              <div className="form-group">
                <label>Текущие теги</label>
                <div className="tags-edit">
                  {taskTags.length === 0 && <div className="no-tags">Нет тегов</div>}
                  {taskTags.map(tag => (
                    <div key={tag.task_tag_id} className="tag-chip" style={{ backgroundColor: tag.tag_color }}>
                      {tag.tag_text}
                      <X size={14} onClick={() => onRemoveTag(tag.task_tag_id)} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <button type="button" className="secondary-btn" onClick={() => setShowTagSelector(!showTagSelector)}>
                  <Plus size={14} /> Добавить тег
                </button>
                {showTagSelector && (
                  <div className="tag-selector">
                    {allTags.filter(t => !taskTags.some(tt => tt.task_tag_id === t.task_tag_id)).map(tag => (
                      <div key={tag.task_tag_id} className="tag-option" onClick={() => { onAssignTag(tag.task_tag_id); setShowTagSelector(false); }}>
                        <span className="tag-color-preview" style={{ backgroundColor: tag.tag_color }}></span>
                        {tag.tag_text}
                      </div>
                    ))}
                    <div className="new-tag-row">
                      <input placeholder="Новый тег" value={newTagText} onChange={e => setNewTagText(e.target.value)} />
                      <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} />
                      <button type="button" onClick={handleCreateTag} disabled={creatingTag}>Создать</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'comments' && task && (
            <div className="tab-content comments-tab">
              <div className="comments-list">
                {comments.length === 0 && <div className="no-comments">Нет комментариев</div>}
                {comments.map(comment => (
                  <div key={comment.comment_id} className="comment-item">
                    <div className="comment-text">{comment.text}</div>
                    <div className="comment-meta">
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                      <button type="button" onClick={() => handleDeleteComment(comment.comment_id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="new-comment">
                <textarea rows={2} value={newCommentText} onChange={e => setNewCommentText(e.target.value)} placeholder="Новый комментарий..." />
                <button type="button" onClick={handleAddComment} disabled={addingComment}><Send size={16} /> Отправить</button>
              </div>
            </div>
          )}
          <div className="modal-buttons">
            <button type="submit" className="primary">Сохранить</button>
            {task && <button type="button" className="danger" onClick={onDelete}>Удалить</button>}
            <button type="button" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;