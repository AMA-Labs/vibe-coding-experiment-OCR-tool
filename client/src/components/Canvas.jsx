import { useState, useCallback, useRef, useEffect } from 'react';
import DocumentCard from './DocumentCard';
import ConnectionLines from './ConnectionLines';
import { uploadFile, mergeElement, aiFill } from '../services/api';
import './Canvas.css';

const MAX_DOCUMENTS = Infinity; // No limit

const VALID_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const VALID_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.docx', '.doc', '.xlsx', '.xls'];

function getDocType(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (file.type === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (['.docx', '.doc'].includes(ext) || file.type.includes('wordprocessingml') || file.type === 'application/msword') return 'docx';
  if (['.xlsx', '.xls'].includes(ext) || file.type.includes('spreadsheetml') || file.type === 'application/vnd.ms-excel') return 'excel';
  return 'unknown';
}

export default function Canvas({ addToast }) {
  const [documents, setDocuments] = useState([]);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const [mergingDocId, setMergingDocId] = useState(null);
  const [connections, setConnections] = useState([]); // { id, elementId, sourceDocId, targetDocId }
  const [connectingFrom, setConnectingFrom] = useState(null); // { elementId, sourceDocId, element }
  const [fillingDocId, setFillingDocId] = useState(null);
  const canvasRef = useRef(null);

  // Handle file drop from OS
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverCanvas(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCanvas(false);
    }
  }, []);

  const handleFileDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOverCanvas(false);

    if (!e.dataTransfer.types.includes('Files') || e.dataTransfer.files.length === 0) {
      return;
    }

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!VALID_TYPES.includes(file.type) && !VALID_EXTENSIONS.includes(ext)) {
      addToast('Supported: PDF, images, DOCX, and Excel files', 'error');
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 200;
    const y = e.clientY - rect.top - 30;

    const docType = getDocType(file);
    const autoProcess = ['pdf', 'docx', 'excel'].includes(docType);

    const tempId = `temp-${Date.now()}`;
    const newDoc = {
      id: tempId,
      name: file.name,
      type: docType,
      status: autoProcess ? 'processing' : 'uploading',
      elements: [],
      position: { x: Math.max(20, x), y: Math.max(20, y) },
      preview: null,
      mimeType: file.type,
    };

    if (docType === 'image') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDocuments(prev => prev.map(d =>
          d.id === tempId ? { ...d, preview: ev.target.result } : d
        ));
      };
      reader.readAsDataURL(file);
    }

    setDocuments(prev => [...prev, newDoc]);
    addToast(`Uploading ${file.name}...`, 'info');

    try {
      const result = await uploadFile(file);
      setDocuments(prev => prev.map(d =>
        d.id === tempId ? {
          ...d,
          id: result.id,
          status: result.status,
          elements: result.elements || [],
          filePath: result.filePath,
          fileName: result.fileName,
          mimeType: result.mimeType,
          preview: result.preview || d.preview,
          error: result.error,
          note: result.note,
          type: result.type || d.type,
        } : d
      ));

      if (result.status === 'ready') {
        addToast(`${file.name}: extracted ${result.elements?.length || 0} elements`, 'success');
      } else if (result.status === 'idle' && docType === 'image') {
        addToast(`${file.name} uploaded. Click "Run OCR" to extract elements.`, 'info');
      } else if (result.note) {
        addToast(result.note, 'info');
      } else if (result.error) {
        addToast(`Error: ${result.error}`, 'error');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setDocuments(prev => prev.filter(d => d.id !== tempId));
      addToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
    }
  }, [documents.length, addToast]);

  // Cancel connecting mode on Escape
  useEffect(() => {
    if (!connectingFrom) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        addToast('Connection cancelled', 'info');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [connectingFrom, addToast]);

  // Handle card position changes
  const handleCardMove = useCallback((docId, newPosition) => {
    setDocuments(prev => prev.map(d =>
      d.id === docId ? { ...d, position: newPosition } : d
    ));
  }, []);

  const handleOCRComplete = useCallback((docId, elements) => {
    setDocuments(prev => prev.map(d =>
      d.id === docId ? { ...d, elements, status: 'ready' } : d
    ));
  }, []);

  const handleStatusChange = useCallback((docId, status) => {
    setDocuments(prev => prev.map(d =>
      d.id === docId ? { ...d, status } : d
    ));
  }, []);

  const handleRemoveDoc = useCallback((docId) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    setConnections(prev => prev.filter(c => c.sourceDocId !== docId && c.targetDocId !== docId));
    addToast('Document removed from canvas', 'info');
  }, [addToast]);

  // Element drop merge
  const handleElementDrop = useCallback(async (targetDocId, element, sourceDocId) => {
    if (targetDocId === sourceDocId) return;

    const targetDoc = documents.find(d => d.id === targetDocId);
    if (!targetDoc) return;

    setMergingDocId(targetDocId);
    addToast('Placing element intelligently...', 'info');

    try {
      const result = await mergeElement(targetDoc.elements, element);
      setDocuments(prev => prev.map(d =>
        d.id === targetDocId ? { ...d, elements: result.elements } : d
      ));
      addToast(`Element placed: ${result.placement.reason}`, 'success');
    } catch (err) {
      console.error('Merge failed:', err);
      setDocuments(prev => prev.map(d => {
        if (d.id !== targetDocId) return d;
        return {
          ...d,
          elements: [...d.elements, { ...element, id: `merged-${Date.now()}`, _justInserted: true }],
        };
      }));
      addToast(`Element appended (LLM unavailable)`, 'info');
    } finally {
      setMergingDocId(null);
    }
  }, [documents, addToast]);

  const handleElementsUpdate = useCallback((docId, newElements) => {
    setDocuments(prev => prev.map(d =>
      d.id === docId ? { ...d, elements: newElements } : d
    ));
  }, []);

  // Connection system
  const handleStartConnect = useCallback((elementId, sourceDocId, element) => {
    setConnectingFrom({ elementId, sourceDocId, element });
    addToast('Click a document card to create a connection (Esc to cancel)', 'info');
  }, [addToast]);

  const handleConnectToDoc = useCallback((targetDocId) => {
    if (!connectingFrom) return;
    if (connectingFrom.sourceDocId === targetDocId) {
      addToast('Cannot connect to the same document', 'error');
      return;
    }
    // Check if connection already exists
    const exists = connections.some(c =>
      c.elementId === connectingFrom.elementId && c.targetDocId === targetDocId
    );
    if (exists) {
      addToast('Connection already exists', 'info');
      setConnectingFrom(null);
      return;
    }

    const newConn = {
      id: `conn-${Date.now()}`,
      elementId: connectingFrom.elementId,
      sourceDocId: connectingFrom.sourceDocId,
      targetDocId,
      element: connectingFrom.element,
    };
    setConnections(prev => [...prev, newConn]);
    setConnectingFrom(null);
    addToast('Connection created! Use "AI Fill" on the target document.', 'success');
  }, [connectingFrom, connections, addToast]);

  const handleRemoveConnection = useCallback((connId) => {
    setConnections(prev => prev.filter(c => c.id !== connId));
  }, []);

  // AI Fill
  const handleAIFill = useCallback(async (targetDocId, instruction) => {
    const targetDoc = documents.find(d => d.id === targetDocId);
    if (!targetDoc) return;

    const docConnections = connections.filter(c => c.targetDocId === targetDocId);
    if (docConnections.length === 0) {
      addToast('No connections to this document. Connect elements first.', 'error');
      return;
    }

    const connectedElements = docConnections.map(c => c.element);

    setFillingDocId(targetDocId);
    addToast('AI is generating content from connected elements...', 'info');

    try {
      const result = await aiFill(targetDoc.elements, connectedElements, instruction);
      setDocuments(prev => prev.map(d =>
        d.id === targetDocId ? { ...d, elements: result.elements, status: 'ready' } : d
      ));
      addToast(`AI Fill complete: ${result.summary}`, 'success');
    } catch (err) {
      console.error('AI Fill failed:', err);
      addToast(`AI Fill failed: ${err.message}`, 'error');
    } finally {
      setFillingDocId(null);
    }
  }, [documents, connections, addToast]);

  // Get connections count for a document
  const getConnectionsForDoc = useCallback((docId) => {
    return connections.filter(c => c.targetDocId === docId);
  }, [connections]);

  // Canvas click handler — for connecting mode
  const handleCanvasClick = useCallback((e) => {
    if (connectingFrom && e.target === canvasRef.current) {
      setConnectingFrom(null);
      addToast('Connection cancelled', 'info');
    }
  }, [connectingFrom, addToast]);

  return (
    <div
      ref={canvasRef}
      className={`canvas ${dragOverCanvas ? 'canvas--drag-over' : ''} ${connectingFrom ? 'canvas--connecting' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
      onClick={handleCanvasClick}
    >
      <div className="canvas__grid" />

      {/* Connection lines SVG overlay */}
      <ConnectionLines
        connections={connections}
        documents={documents}
        canvasRef={canvasRef}
        onRemoveConnection={handleRemoveConnection}
      />

      {/* Connecting mode indicator */}
      {connectingFrom && (
        <div className="canvas__connecting-banner">
          <div className="canvas__connecting-dot" />
          <span>Connecting element — click a target document card</span>
          <button onClick={() => setConnectingFrom(null)}>Cancel</button>
        </div>
      )}

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="canvas__empty">
          <div className="canvas__empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h2 className="canvas__empty-title">Drop documents here</h2>
          <p className="canvas__empty-subtitle">
            Drag PDFs, images, DOCX, or Excel files onto this canvas.<br />
            PDFs, DOCX, and Excel are auto-processed with LLM-powered OCR.<br />
            Images require a manual OCR trigger.
          </p>
          <p className="canvas__empty-subtitle" style={{ marginTop: 8, opacity: 0.7 }}>
            Connect elements between documents and use AI Fill to generate content.
          </p>
          <div className="canvas__empty-limits">Drop as many documents as you need</div>
        </div>
      )}

      {/* Drop overlay */}
      {dragOverCanvas && (
        <div className="canvas__drop-overlay">
          <div className="canvas__drop-overlay-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop to add document</span>
          </div>
        </div>
      )}

      {/* Document cards */}
      {documents.map(doc => (
        <DocumentCard
          key={doc.id}
          doc={doc}
          onMove={handleCardMove}
          onOCRComplete={handleOCRComplete}
          onStatusChange={handleStatusChange}
          onRemove={handleRemoveDoc}
          onElementDrop={handleElementDrop}
          onElementsUpdate={handleElementsUpdate}
          onStartConnect={handleStartConnect}
          onConnectToDoc={handleConnectToDoc}
          onAIFill={handleAIFill}
          isMerging={mergingDocId === doc.id}
          isFilling={fillingDocId === doc.id}
          isConnecting={!!connectingFrom}
          isConnectSource={connectingFrom?.sourceDocId === doc.id}
          incomingConnections={getConnectionsForDoc(doc.id)}
          addToast={addToast}
          canvasRef={canvasRef}
        />
      ))}
    </div>
  );
}
