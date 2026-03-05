import { useState, useCallback, useRef, useEffect } from 'react';
import './ElementItem.css';

const TYPE_ICONS = {
  heading: 'H',
  paragraph: '¶',
  list: '≡',
  table: '⊞',
  quote: '"',
  code: '<>',
  metadata: 'ℹ',
  caption: '◻',
};

const TYPE_COLORS = {
  heading: '#d2a8ff',
  paragraph: '#8b949e',
  list: '#79c0ff',
  table: '#56d364',
  quote: '#f0883e',
  code: '#ff7b72',
  metadata: '#8b949e',
  caption: '#d2a8ff',
};

export default function ElementItem({ element, sourceDocId, onRemove, onStartConnect }) {
  const [showFull, setShowFull] = useState(false);
  const [justInserted, setJustInserted] = useState(!!element._justInserted);
  const itemRef = useRef(null);

  useEffect(() => {
    if (justInserted) {
      const timer = setTimeout(() => setJustInserted(false), 2000);
      itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return () => clearTimeout(timer);
    }
  }, [justInserted]);

  const handleDragStart = useCallback((e) => {
    const data = {
      element: { type: element.type, content: element.content, label: element.label },
      sourceDocId,
    };
    e.dataTransfer.setData('application/x-element', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'copy';
    
    const ghost = document.createElement('div');
    ghost.className = 'element-drag-ghost';
    ghost.textContent = element.label || element.content.slice(0, 40);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, [element, sourceDocId]);

  const handleConnect = useCallback((e) => {
    e.stopPropagation();
    onStartConnect(element.id, sourceDocId, {
      type: element.type,
      content: element.content,
      label: element.label,
    });
  }, [element, sourceDocId, onStartConnect]);

  const truncatedContent = element.content.length > 150
    ? element.content.slice(0, 150) + '...'
    : element.content;

  const typeColor = TYPE_COLORS[element.type] || '#8b949e';
  const typeIcon = TYPE_ICONS[element.type] || '·';

  return (
    <div
      ref={itemRef}
      className={`element-item ${justInserted ? 'element-item--inserted' : ''}`}
      draggable
      onDragStart={handleDragStart}
      data-element-id={element.id}
    >
      <div className="element-item__header">
        <span
          className="element-item__type-badge"
          style={{ color: typeColor, borderColor: `${typeColor}33` }}
        >
          <span className="element-item__type-icon">{typeIcon}</span>
          {element.type}
        </span>
        <div className="element-item__actions">
          <button
            className="element-item__btn element-item__btn--connect"
            onClick={handleConnect}
            title="Connect to another document"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          <button
            className="element-item__btn"
            onClick={() => setShowFull(!showFull)}
            title={showFull ? 'Show less' : 'Show full content'}
          >
            {showFull ? '−' : '+'}
          </button>
          <button
            className="element-item__btn element-item__btn--remove"
            onClick={() => onRemove(element.id)}
            title="Remove element"
          >
            ×
          </button>
        </div>
      </div>

      {element.label && (
        <div className="element-item__label">{element.label}</div>
      )}

      <div className={`element-item__content ${showFull ? 'element-item__content--full' : ''}`}>
        {showFull ? element.content : truncatedContent}
      </div>

      <div className="element-item__drag-hint">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="8" cy="4" r="2" />
          <circle cx="16" cy="4" r="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <circle cx="8" cy="20" r="2" />
          <circle cx="16" cy="20" r="2" />
        </svg>
      </div>
    </div>
  );
}
