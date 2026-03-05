const express = require('express');
const path = require('path');

const router = express.Router();

/**
 * POST /api/export
 * Generate a downloadable document from elements
 * Body: { elements, filename, format }
 * format: 'markdown' | 'text'
 */
router.post('/export', (req, res) => {
  try {
    const { elements, filename, format = 'markdown' } = req.body;

    if (!elements || elements.length === 0) {
      return res.status(400).json({ error: 'No elements to export' });
    }

    let content;
    let mimeType;
    let ext;

    if (format === 'markdown') {
      content = elementsToMarkdown(elements);
      mimeType = 'text/markdown';
      ext = '.md';
    } else {
      content = elementsToText(elements);
      mimeType = 'text/plain';
      ext = '.txt';
    }

    // Generate filename
    const baseName = filename
      ? filename.replace(/\.[^.]+$/, '')
      : 'document';
    const outputName = `${baseName}${ext}`;

    res.setHeader('Content-Type', `${mimeType}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    res.send(content);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/download/:filename
 * Download the original uploaded file
 */
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(__dirname, '..', 'uploads', safeName);

    res.download(filePath, req.query.originalName || safeName, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'File not found' });
        }
      }
    });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
});

function elementsToMarkdown(elements) {
  return elements.map(el => {
    switch (el.type) {
      case 'heading':
        // Try to detect heading level from content
        if (el.content.length < 40) return `# ${el.content}\n`;
        return `## ${el.content}\n`;
      case 'paragraph':
        return `${el.content}\n`;
      case 'list':
        // Format as bullet list if not already
        const lines = el.content.split('\n').filter(l => l.trim());
        const formatted = lines.map(l => {
          const trimmed = l.trim();
          if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*') || /^\d+[.)]/.test(trimmed)) {
            return trimmed;
          }
          return `- ${trimmed}`;
        }).join('\n');
        return `${formatted}\n`;
      case 'table':
        return `\`\`\`\n${el.content}\n\`\`\`\n`;
      case 'quote':
        return el.content.split('\n').map(l => `> ${l}`).join('\n') + '\n';
      case 'code':
        return `\`\`\`\n${el.content}\n\`\`\`\n`;
      case 'metadata':
        return `*${el.content}*\n`;
      case 'caption':
        return `*${el.content}*\n`;
      default:
        return `${el.content}\n`;
    }
  }).join('\n');
}

function elementsToText(elements) {
  return elements.map(el => {
    if (el.type === 'heading') {
      return `${el.content.toUpperCase()}\n${'='.repeat(Math.min(el.content.length, 60))}`;
    }
    return el.content;
  }).join('\n\n');
}

module.exports = router;
