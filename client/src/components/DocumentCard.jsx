import { useState, useCallback, useRef, useEffect } from 'react';
import ElementItem from './ElementItem';
import { runOCR, exportDocument, downloadOriginal } from '../services/api';
import './DocumentCard.css';

const TYPE_ICONS = {
  pdf: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  image: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  docx: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  excel: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
};

const TYPE_COLORS = {
  pdf: { bg: 'rgba(248, 81, 73, 0.12)', color: '#f85149' },
  image: { bg: 'rgba(88, 166, 255, 0.12)', color: '#58a6ff' },
  docx: { bg: 'rgba(79, 139, 255, 0.12)', color: '#4f8bff' },
  excel: { bg: 'rgba(63, 185, 80, 0.12)', color: '#3fb950' },
};

export default function DocumentCard({
  doc,
  onMove,
  onOCRComplete,
  onStatusChange,
  onRemove,
  onElementDrop,
  onElementsUpdate,
  onStartConnect,
  onConnectToDoc,
  onAIFill,
  isMerging,
  isFilling,
  isConnecting,
  isConnectSource,
  incomingConnections,
  addToast,
  canvasRef,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [fillInstruction, setFillInstruction] = useState('');
  const [showFillInput, setShowFillInput] = useState(false);
  const [cardWidth, setCardWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const cardRef = useRef(null);
  const dragStart = useRef(null);
  const resizeStart = useRef(null);

  // Card dragging (reposition on canvas)
  const handleHeaderMouseDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      cardX: doc.position.x,
      cardY: doc.position.y,
    };
  }, [doc.position]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      onMove(doc.id, {
        x: Math.max(0, dragStart.current.cardX + dx),
        y: Math.max(0, dragStart.current.cardY + dy),
      });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStart.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, doc.id, onMove]);

  // Handle OCR button click (images only)
  const handleRunOCR = useCallback(async () => {
    if (doc.status === 'processing') return;
    onStatusChange(doc.id, 'processing');
    addToast(`Running OCR on ${doc.name}...`, 'info');
    try {
      const result = await runOCR(doc.id, doc.fileName, doc.mimeType);
      onOCRComplete(doc.id, result.elements);
      addToast(`Extracted ${result.elements.length} elements from ${doc.name}`, 'success');
    } catch (err) {
      console.error('OCR failed:', err);
      onStatusChange(doc.id, 'error');
      addToast(`OCR failed: ${err.message}`, 'error');
    }
  }, [doc, onStatusChange, onOCRComplete, addToast]);

  // Element drag-and-drop target
  const handleDragOverCard = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/x-element')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDropTarget(true);
    }
  }, []);

  const handleDragLeaveCard = useCallback((e) => {
    if (!cardRef.current?.contains(e.relatedTarget)) {
      setIsDropTarget(false);
    }
  }, []);

  const handleDropOnCard = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    const data = e.dataTransfer.getData('application/x-element');
    if (!data) return;
    try {
      const { element, sourceDocId } = JSON.parse(data);
      if (sourceDocId !== doc.id) {
        onElementDrop(doc.id, element, sourceDocId);
      }
    } catch (err) {
      console.error('Drop parse error:', err);
    }
  }, [doc.id, onElementDrop]);

  // Handle card click when in connecting mode
  const handleCardClick = useCallback((e) => {
    if (isConnecting && !isConnectSource) {
      e.stopPropagation();
      onConnectToDoc(doc.id);
    }
  }, [isConnecting, isConnectSource, doc.id, onConnectToDoc]);

  // Remove element
  const handleRemoveElement = useCallback((elementId) => {
    const newElements = doc.elements.filter(el => el.id !== elementId);
    onElementsUpdate(doc.id, newElements);
  }, [doc.id, doc.elements, onElementsUpdate]);

  // AI Fill
  const handleFillClick = useCallback(() => {
    if (incomingConnections.length === 0) {
      addToast('Connect elements from another document first', 'info');
      return;
    }
    setShowFillInput(!showFillInput);
  }, [incomingConnections, showFillInput, addToast]);

  const handleFillSubmit = useCallback(() => {
    onAIFill(doc.id, fillInstruction);
    setShowFillInput(false);
    setFillInstruction('');
  }, [doc.id, fillInstruction, onAIFill]);

  // Resize handle
  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { mouseX: e.clientX, width: cardWidth };
  }, [cardWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e) => {
      if (!resizeStart.current) return;
      const dx = e.clientX - resizeStart.current.mouseX;
      setCardWidth(Math.max(300, Math.min(800, resizeStart.current.width + dx)));
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStart.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Download handlers
  const handleDownloadOriginal = useCallback(() => {
    if (doc.fileName) {
      downloadOriginal(doc.fileName, doc.name);
      addToast(`Downloading original: ${doc.name}`, 'info');
    }
  }, [doc.fileName, doc.name, addToast]);

  const handleExportFilled = useCallback(async (format = 'markdown') => {
    try {
      await exportDocument(doc.elements, doc.name, format);
      addToast(`Exported as ${format === 'markdown' ? 'Markdown' : 'Text'}`, 'success');
    } catch (err) {
      addToast(`Export failed: ${err.message}`, 'error');
    }
  }, [doc.elements, doc.name, addToast]);

  const isProcessing = doc.status === 'processing';
  const isImage = doc.type === 'image';
  const hasElements = doc.elements.length > 0;
  const hasConnections = incomingConnections.length > 0;

  const typeColor = TYPE_COLORS[doc.type] || TYPE_COLORS.pdf;
  const typeIcon = TYPE_ICONS[doc.type] || TYPE_ICONS.pdf;
  const typeLabel = doc.type === 'docx' ? 'DOCX' : doc.type === 'excel' ? 'EXCEL' : doc.type.toUpperCase();

  return (
    <div
      ref={cardRef}
      className={`doc-card ${isDragging ? 'doc-card--dragging' : ''} ${isDropTarget ? 'doc-card--drop-target' : ''} ${isMerging ? 'doc-card--merging' : ''} ${isProcessing ? 'doc-card--processing' : ''} ${isConnecting && !isConnectSource ? 'doc-card--connect-target' : ''} ${isFilling ? 'doc-card--filling' : ''}`}
      style={{ left: doc.position.x, top: doc.position.y, width: cardWidth }}
      onDragOver={handleDragOverCard}
      onDragLeave={handleDragLeaveCard}
      onDrop={handleDropOnCard}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="doc-card__header" onMouseDown={handleHeaderMouseDown}>
        <div className="doc-card__header-left">
          <span className="doc-card__type-icon" style={{ background: typeColor.bg, color: typeColor.color }}>
            {typeIcon}
          </span>
          <div className="doc-card__title-group">
            <span className="doc-card__name" title={doc.name}>{doc.name}</span>
            <span className="doc-card__meta">
              {typeLabel}
              {hasElements && ` · ${doc.elements.length} elements`}
              {hasConnections && ` · ${incomingConnections.length} connected`}
            </span>
          </div>
        </div>
        <div className="doc-card__header-actions">
          {hasElements && (
            <button className="doc-card__btn doc-card__btn--icon" onClick={() => setExpanded(!expanded)} title={expanded ? 'Collapse' : 'Expand'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          <button className="doc-card__btn doc-card__btn--icon doc-card__btn--close" onClick={() => onRemove(doc.id)} title="Remove from canvas">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status bar */}
      {isProcessing && (
        <div className="doc-card__status-bar">
          <div className="doc-card__spinner" />
          <span>Processing with LLM...</span>
        </div>
      )}
      {doc.status === 'error' && (
        <div className="doc-card__status-bar doc-card__status-bar--error">
          <span>⚠ Error: {doc.error || 'Processing failed'}</span>
        </div>
      )}
      {doc.note && !hasElements && (
        <div className="doc-card__status-bar doc-card__status-bar--note">
          <span>{doc.note}</span>
        </div>
      )}

      {/* Image preview */}
      {isImage && doc.preview && (
        <div className="doc-card__preview-section">
          <div className={`doc-card__preview ${showPreview ? 'doc-card__preview--expanded' : ''}`} onClick={() => setShowPreview(!showPreview)}>
            <img src={doc.preview} alt={doc.name} />
          </div>
          {doc.status === 'idle' && !hasElements && (
            <button className="doc-card__btn doc-card__btn--ocr" onClick={handleRunOCR}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Run OCR
            </button>
          )}
        </div>
      )}

      {/* AI Fill section */}
      {(hasConnections || hasElements) && (
        <div className="doc-card__fill-section">
          <button
            className={`doc-card__btn doc-card__btn--fill ${hasConnections ? 'doc-card__btn--fill-active' : ''}`}
            onClick={handleFillClick}
            disabled={isFilling}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {isFilling ? 'Filling...' : `AI Fill${hasConnections ? ` (${incomingConnections.length})` : ''}`}
          </button>
          {showFillInput && (
            <div className="doc-card__fill-input-wrap">
              <input
                className="doc-card__fill-input"
                type="text"
                placeholder="Optional: instruction for AI (e.g., 'summarize into bullet points')"
                value={fillInstruction}
                onChange={(e) => setFillInstruction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFillSubmit()}
                autoFocus
              />
              <button className="doc-card__btn doc-card__btn--fill-go" onClick={handleFillSubmit}>
                Go
              </button>
            </div>
          )}
        </div>
      )}

      {/* Merge / Fill overlay */}
      {(isMerging || isFilling) && (
        <div className="doc-card__merge-overlay">
          <div className="doc-card__spinner" />
          <span>{isFilling ? 'AI is generating content...' : 'Placing element...'}</span>
        </div>
      )}

      {/* Drop target overlay */}
      {isDropTarget && (
        <div className="doc-card__drop-hint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Drop element here</span>
        </div>
      )}

      {/* Connect target highlight */}
      {isConnecting && !isConnectSource && (
        <div className="doc-card__connect-hint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>Click to connect here</span>
        </div>
      )}

      {/* Download section */}
      {hasElements && (
        <div className="doc-card__download-section">
          <button className="doc-card__btn doc-card__btn--download" onClick={handleDownloadOriginal} title="Download original file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Original
          </button>
          <button className="doc-card__btn doc-card__btn--download doc-card__btn--download-filled" onClick={() => handleExportFilled('markdown')} title="Export current elements as Markdown">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export .md
          </button>
          <button className="doc-card__btn doc-card__btn--download doc-card__btn--download-filled" onClick={() => handleExportFilled('text')} title="Export current elements as plain text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export .txt
          </button>
        </div>
      )}

      {/* Elements list */}
      {expanded && hasElements && (
        <div className="doc-card__elements">
          {doc.elements.map((element) => (
            <ElementItem
              key={element.id}
              element={element}
              sourceDocId={doc.id}
              onRemove={handleRemoveElement}
              onStartConnect={onStartConnect}
            />
          ))}
        </div>
      )}

      {/* Empty elements hint */}
      {expanded && !isImage && doc.status === 'ready' && !hasElements && (
        <div className="doc-card__empty-hint">
          No elements extracted
        </div>
      )}

      {/* Resize handle */}
      <div className="doc-card__resize-handle" onMouseDown={handleResizeMouseDown}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="8" cy="2" r="1.2" />
          <circle cx="8" cy="5.5" r="1.2" />
          <circle cx="8" cy="9" r="1.2" />
          <circle cx="4.5" cy="5.5" r="1.2" />
          <circle cx="4.5" cy="9" r="1.2" />
          <circle cx="1" cy="9" r="1.2" />
        </svg>
      </div>
    </div>
  );
}
