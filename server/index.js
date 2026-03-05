require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { authenticateToken } = require('./middleware/auth');

// Initialize database
require('./db');

const authRouter = require('./routes/auth');
const uploadRouter = require('./routes/upload');
const ocrRouter = require('./routes/ocr');
const mergeRouter = require('./routes/merge');
const fillRouter = require('./routes/fill');
const exportRouter = require('./routes/export');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
}

// Public routes
app.use('/api', authRouter);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasApiKey: !!process.env.OPENAI_API_KEY });
});

// Protected routes - require authentication
app.use('/api', authenticateToken);
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', uploadRouter);
app.use('/api', ocrRouter);
app.use('/api', mergeRouter);
app.use('/api', fillRouter);
app.use('/api', exportRouter);

// SPA fallback for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  No OPENAI_API_KEY found.');
  } else {
    console.log('✅ OpenAI API key loaded');
  }
});
