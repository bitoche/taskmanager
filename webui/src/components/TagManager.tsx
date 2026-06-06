import React, { useState } from 'react';
import { TaskTag } from '../types';
import { Plus, X, Check, Edit2 } from 'lucide-react';

interface Props {
  allTags: TaskTag[];
  onCreateTag: (text: string, color: string) => Promise<void>;
  onFilterByTag: (tagId: number | null) => void;
  activeFilterTagId: number | null;
  onDeleteTagGlobally?: (tagId: number) => Promise<void>;
  onUpdateTag?: (tagId: number, text: string, color: string) => Promise<void>; // новый проп
}

const TagManager: React.FC<Props> = ({ 
  allTags, onCreateTag, onFilterByTag, activeFilterTagId, 
  onDeleteTagGlobally, onUpdateTag 
}) => {
  const [showCreator, setShowCreator] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#e0e0e0');
  const [creating, setCreating] = useState(false);

  // Состояния для редактирования
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editColor, setEditColor] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleCreate = async () => {
    if (!newTagText.trim()) return;
    setCreating(true);
    try {
      await onCreateTag(newTagText.trim(), newTagColor);
      setNewTagText('');
      setNewTagColor('#e0e0e0');
      setShowCreator(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = async (tagId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeleteTagGlobally) return;
    if (window.confirm('Удалить тег полностью? Он исчезнет у всех задач.')) {
      await onDeleteTagGlobally(tagId);
      if (activeFilterTagId === tagId) onFilterByTag(null);
    }
  };

  // Обработчик двойного клика – начать редактирование
  const handleDoubleClick = (tag: TaskTag, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTagId(tag.task_tag_id);
    setEditText(tag.tag_text);
    setEditColor(tag.tag_color || '#e0e0e0');
  };

  // Сохранить изменения тега
  const handleUpdateTag = async () => {
    if (!onUpdateTag || editingTagId === null) return;
    if (!editText.trim()) {
      alert('Название тега не может быть пустым');
      return;
    }
    setUpdating(true);
    try {
      await onUpdateTag(editingTagId, editText.trim(), editColor);
      setEditingTagId(null);
    } catch (err) {
      console.error(err);
      alert('Ошибка при обновлении тега');
    } finally {
      setUpdating(false);
    }
  };

  // Отмена редактирования
  const cancelEdit = () => {
    setEditingTagId(null);
  };

  return (
    <div className="tag-manager">
      <div className="tag-manager-header">
        <h4>Теги</h4>
        <button className="add-tag-btn" onClick={() => setShowCreator(!showCreator)}>
          <Plus size={16} /> Новый тег
        </button>
      </div>
      {showCreator && (
        <div className="tag-creator">
          <input
            type="text"
            placeholder="Название тега"
            value={newTagText}
            onChange={(e) => setNewTagText(e.target.value)}
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            title="Цвет"
          />
          <button onClick={handleCreate} disabled={creating}>
            {creating ? '...' : 'Создать'}
          </button>
        </div>
      )}
      <div className="tag-list">
        <div
          className={`tag-filter-item ${activeFilterTagId === null ? 'active' : ''}`}
          onClick={() => onFilterByTag(null)}
        >
          Все задачи
        </div>
        {allTags.map(tag => (
          <div
            key={tag.task_tag_id}
            className={`tag-filter-item ${activeFilterTagId === tag.task_tag_id ? 'active' : ''}`}
            onClick={() => onFilterByTag(tag.task_tag_id)}
            // onDoubleClick={(e) => handleDoubleClick(tag, e)}
            title="Дабл-клик, чтобы изменить тег"
          >
            {editingTagId === tag.task_tag_id ? (
              <div className="tag-edit-form" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                  size={10}
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  title="Цвет"
                />
                <button onClick={handleUpdateTag} disabled={updating}>
                  <Check size={14} />
                </button>
                <button onClick={cancelEdit}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className="tag-color-dot" style={{ backgroundColor: tag.tag_color }}></span>
                {tag.tag_text}
                <Edit2
                  size={14}
                  className="tag-action-icon"
                  onClick={(e) => handleDoubleClick(tag, e)}
                />
                {onDeleteTagGlobally && (
                  <X
                    size={14}
                    className="tag-action-icon"
                    onClick={(e) => handleDeleteTag(tag.task_tag_id, e)}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagManager;