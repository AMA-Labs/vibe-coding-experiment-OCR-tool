const API_BASE = '/api';

function getHeaders(contentType = true) {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (contentType) headers['Content-Type'] = 'application/json';
  return headers;
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return response.json();
}

export async function runOCR(docId, fileName, mimeType) {
  const response = await fetch(`${API_BASE}/ocr`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ docId, fileName, mimeType }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'OCR failed' }));
    throw new Error(err.error || 'OCR failed');
  }
  return response.json();
}

export async function mergeElement(targetElements, newElement) {
  const response = await fetch(`${API_BASE}/merge`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ targetElements, newElement }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Merge failed' }));
    throw new Error(err.error || 'Merge failed');
  }
  return response.json();
}

export async function aiFill(targetElements, connectedElements, instruction) {
  const response = await fetch(`${API_BASE}/fill`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ targetElements, connectedElements, instruction }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'AI Fill failed' }));
    throw new Error(err.error || 'AI Fill failed');
  }
  return response.json();
}

export async function exportDocument(elements, filename, format = 'markdown') {
  const response = await fetch(`${API_BASE}/export`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ elements, filename, format }),
  });
  if (!response.ok) throw new Error('Export failed');

  const blob = await response.blob();
  const ext = format === 'markdown' ? '.md' : '.txt';
  const baseName = filename ? filename.replace(/\.[^.]+$/, '') : 'document';
  const downloadName = `${baseName}${ext}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadOriginal(fileName, originalName) {
  const token = localStorage.getItem('token');
  const url = `${API_BASE}/download/${encodeURIComponent(fileName)}?originalName=${encodeURIComponent(originalName)}`;
  // For auth, open in a new approach
  fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then(r => r.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    });
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
