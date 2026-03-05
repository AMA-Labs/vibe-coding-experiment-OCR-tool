# OCR Canvas Workspace

A freeform visual workspace for dragging in documents, running LLM-powered OCR, and reshaping documents by moving extracted elements between them.

![Canvas Workspace](https://img.shields.io/badge/status-experimental-yellow)

## What It Does

- **Drag & drop documents** — Drop up to 2 PDFs or images directly onto the canvas from your file system
- **Automatic PDF OCR** — PDFs are immediately processed: text is extracted and broken into semantic elements (headings, paragraphs, lists, tables, etc.) using an LLM
- **Manual Image OCR** — Images appear with a preview and a "Run OCR" button; click it to extract text elements via GPT-4 Vision
- **Visual element registry** — Browse extracted elements in each document card, expand/collapse content, see type badges
- **Drag elements between documents** — Grab any element from one document and drop it onto another
- **Intelligent placement** — The LLM determines where the element fits best in the target document's structure
- **Freeform canvas** — Position document cards anywhere on an infinite dark canvas with grid dots

## Quick Start

### Prerequisites

- Node.js 18+
- An OpenAI API key (GPT-4o)

### Setup

```bash
# Clone and enter the project
git clone https://github.com/AMA-Labs/vibe-coding-experiment-OCR-tool.git
cd vibe-coding-experiment-OCR-tool

# Install all dependencies
npm run install:all

# Create your .env file
cp .env.example .env
# Edit .env and add your OpenAI API key

# Start both server and client
npm run dev
```

The app will be available at **http://localhost:5173**

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `PORT` | Server port | `3001` |

## Architecture

```
├── server/
│   ├── index.js              # Express server entry
│   ├── routes/
│   │   ├── upload.js          # File upload + auto PDF OCR
│   │   ├── ocr.js             # Manual image OCR endpoint
│   │   └── merge.js           # LLM-powered intelligent placement
│   └── services/
│       ├── llm.js             # OpenAI API integration
│       └── pdf.js             # PDF text extraction
├── client/
│   ├── src/
│   │   ├── App.jsx            # Root component + health check
│   │   ├── components/
│   │   │   ├── Canvas.jsx     # Freeform workspace + file drop
│   │   │   ├── DocumentCard.jsx # Document card with elements
│   │   │   ├── ElementItem.jsx  # Draggable element
│   │   │   └── Toast.jsx       # Notification toasts
│   │   └── services/
│   │       └── api.js          # Backend API client
│   └── vite.config.js         # Vite + proxy config
```

## How It Works

1. **Drop a file** → uploaded to server via `/api/upload`
2. **PDF path**: `pdf-parse` extracts text → GPT-4o segments it into semantic elements → elements returned to UI
3. **Image path**: file stored, preview shown → user clicks "Run OCR" → GPT-4 Vision extracts elements
4. **Element drag**: grab an element → drop onto another document card → `/api/merge` sends target elements + new element to GPT-4o → LLM determines optimal insertion position → updated element list returned

## License

See [LICENSE](LICENSE).
