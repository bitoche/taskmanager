import React, { useState, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Code, Quote, Edit2, Eye } from 'lucide-react';
import './MarkdownEditor.css';

// Простой Markdown рендерер
export const renderMarkdown = (text: string): string => {
  if (!text) return '';
  
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Кодовые блоки
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="markdown-code-block">$2</code></pre>')
    
    // Инлайновый код
    .replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>')
    
    // Заголовки
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    
    // Жирный и курсив
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    
    // Цитаты
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    
    // Списки с маркерами
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    
    // Нумерованные списки
    .replace(/^\d+\. (.+)$/gm, '<li class="ordered-list-item">$1</li>')
    .replace(/(<li class="ordered-list-item">.*<\/li>\n?)+/g, '<ol>$&</ol>')
    
    // Ссылки
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Разделители
    .replace(/^---$/gm, '<hr/>')
    
    // Переносы строк
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  
  // Обертка в параграфы, если нет заголовков/списков
  if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<pre')) {
    html = '<p>' + html + '</p>';
  }
  
  return html;
};

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  className?: string;
  defaultPreview?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  rows = 3, 
  label,
  className,
  defaultPreview = false
}) => {
  const [showPreview, setShowPreview] = useState(defaultPreview);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const toolbarButtons = [
    { icon: Bold, action: () => insertMarkdown('**', '**'), title: 'Жирный' },
    { icon: Italic, action: () => insertMarkdown('*', '*'), title: 'Курсив' },
    { icon: List, action: () => insertMarkdown('- '), title: 'Список' },
    { icon: ListOrdered, action: () => insertMarkdown('1. '), title: 'Нумерованный список' },
    { icon: Quote, action: () => insertMarkdown('> '), title: 'Цитата' },
    { icon: Code, action: () => insertMarkdown('`', '`'), title: 'Код' },
    { icon: LinkIcon, action: () => insertMarkdown('[', '](url)'), title: 'Ссылка' },
  ];

  return (
    <div className={`markdown-editor ${className || ''}`}>
      {label && <label>{label}</label>}
      <div className="markdown-toolbar">
        <div className="markdown-buttons">
          {toolbarButtons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              className="markdown-btn"
              onClick={btn.action}
              title={btn.title}
            >
              <btn.icon size={14} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="preview-toggle"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <><Edit2 size={14} /> Редактировать</> : <><Eye size={14} /> Превью</>}
        </button>
      </div>
      {showPreview ? (
        <div 
          className="markdown-preview"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="markdown-textarea"
        />
      )}
    </div>
  );
};

export default MarkdownEditor;
