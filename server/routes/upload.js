const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { extractPdfText } = require('../services/pdf');
const { extractDocxText } = require('../services/docx');
const { extractExcelData, excelToText } = require('../services/excel');
const { extractElementsFromText } = require('../services/llm');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomUUID();
    cb(null, `${name}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/tiff',
      // DOCX
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      // Excel
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.docx', '.doc', '.xlsx', '.xls'];
    
    if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`));
    }
  }
});

function getFileType(mimetype, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (mimetype === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (mimetype.startsWith('image/')) return 'image';
  if (ext === '.docx' || ext === '.doc' || mimetype.includes('wordprocessingml') || mimetype === 'application/msword') return 'docx';
  if (ext === '.xlsx' || ext === '.xls' || mimetype.includes('spreadsheetml') || mimetype === 'application/vnd.ms-excel') return 'excel';
  return 'unknown';
}

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileType = getFileType(file.mimetype, file.originalname);
    const docId = path.basename(file.filename, path.extname(file.filename));

    const doc = {
      id: docId,
      name: file.originalname,
      type: fileType,
      mimeType: file.mimetype,
      filePath: `/api/uploads/${file.filename}`,
      fileName: file.filename,
      status: 'idle',
      elements: [],
      preview: null,
    };

    if (fileType === 'pdf') {
      // Auto-run OCR for PDFs
      doc.status = 'processing';
      try {
        const pdfData = await extractPdfText(file.path);
        if (pdfData.text && pdfData.text.trim().length > 0) {
          const elements = await extractElementsFromText(pdfData.text, file.originalname);
          doc.elements = elements.map((el, idx) => ({
            ...el,
            id: `${docId}-el-${idx}`,
          }));
          doc.status = 'ready';
        } else {
          doc.status = 'idle';
          doc.elements = [];
          doc.note = 'No text found in PDF. This may be a scanned document.';
        }
      } catch (err) {
        console.error('PDF processing error:', err);
        doc.status = 'error';
        doc.error = err.message;
      }
    } else if (fileType === 'docx') {
      // Auto-process DOCX files
      doc.status = 'processing';
      try {
        const docxData = await extractDocxText(file.path);
        if (docxData.text && docxData.text.trim().length > 0) {
          const elements = await extractElementsFromText(docxData.text, file.originalname);
          doc.elements = elements.map((el, idx) => ({
            ...el,
            id: `${docId}-el-${idx}`,
          }));
          doc.status = 'ready';
        } else {
          doc.status = 'idle';
          doc.note = 'No text found in document.';
        }
      } catch (err) {
        console.error('DOCX processing error:', err);
        doc.status = 'error';
        doc.error = err.message;
      }
    } else if (fileType === 'excel') {
      // Auto-process Excel files
      doc.status = 'processing';
      try {
        const excelData = extractExcelData(file.path);
        const text = excelToText(excelData);
        if (text.trim().length > 0) {
          const elements = await extractElementsFromText(text, file.originalname);
          doc.elements = elements.map((el, idx) => ({
            ...el,
            id: `${docId}-el-${idx}`,
          }));
          // Also add raw sheet data as table elements
          for (const sheet of excelData.sheets) {
            if (sheet.rowCount > 0) {
              doc.elements.push({
                id: `${docId}-sheet-${sheet.name}`,
                type: 'table',
                label: `Sheet: ${sheet.name} (${sheet.rowCount} rows × ${sheet.colCount} cols)`,
                content: sheet.csv.slice(0, 3000),
              });
            }
          }
          doc.status = 'ready';
        } else {
          doc.status = 'idle';
          doc.note = 'No data found in spreadsheet.';
        }
      } catch (err) {
        console.error('Excel processing error:', err);
        doc.status = 'error';
        doc.error = err.message;
      }
    } else if (fileType === 'image') {
      // Images: create a base64 preview, but don't auto-OCR
      const imageBuffer = fs.readFileSync(file.path);
      doc.preview = `data:${file.mimetype};base64,${imageBuffer.toString('base64')}`;
      doc.status = 'idle';
    }

    res.json(doc);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
