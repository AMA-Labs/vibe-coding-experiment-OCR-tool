const express = require('express');
const path = require('path');
const fs = require('fs');
const { ocrImage } = require('../services/llm');

const router = express.Router();

/**
 * POST /api/ocr
 * Run OCR on an uploaded image file
 * Body: { docId, fileName, mimeType }
 */
router.post('/ocr', async (req, res) => {
  try {
    const { docId, fileName, mimeType } = req.body;

    if (!docId || !fileName) {
      return res.status(400).json({ error: 'docId and fileName are required' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');
    const mime = mimeType || 'image/png';

    const elements = await ocrImage(base64, mime, fileName);

    const result = elements.map((el, idx) => ({
      ...el,
      id: `${docId}-el-${idx}`,
    }));

    res.json({ docId, elements: result });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
