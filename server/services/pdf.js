const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Extract raw text from a PDF file
 */
async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info,
  };
}

module.exports = { extractPdfText };
