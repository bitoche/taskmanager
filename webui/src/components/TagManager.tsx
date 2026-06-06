import React, { useState } from 'react';
import { TaskTag } from '../types';
import { Plus, X } from 'lucide-react';

interface Props {
  allTags: TaskTag[];
  onCreateTag: (text: string, color: string) => Promise<void>;
  onFilterByTag: (tagId: number | null) => void;   // null – сброс фильтра
  activeFilterTagId: number | null;
  onDeleteTagGlobally?: (tagId: number) => Promise<void>; // опционально
}

const TagManager: React.FC<Props> = ({ allTags, onCreateTag, onFilterByTag, activeFilterTagId, onDeleteTagGlobally }) => {
  const [showCreator, setShowCreator] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#e0e0e0');
  const [creating, setCreating] = useState(false);

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
          >
            <span className="tag-color-dot" style={{ backgroundColor: tag.tag_color }}></span>
            {tag.tag_text}
            {onDeleteTagGlobally && (
              <X
                size={14}
                className="tag-delete-icon"
                onClick={(e) => handleDeleteTag(tag.task_tag_id, e)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagManager;