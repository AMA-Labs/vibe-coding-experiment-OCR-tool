const mammoth = require('mammoth');
const fs = require('fs');

/**
 * Extract text and structure from a DOCX file
 */
async function extractDocxText(filePath) {
  const buffer = fs.readFileSync(filePath);

  // Extract as plain text
  const textResult = await mammoth.extractRawText({ buffer });

  // Extract as simplified HTML (preserves structure)
  const htmlResult = await mammoth.convertToHtml({ buffer });

  return {
    text: textResult.value,
    html: htmlResult.value,
    messages: textResult.messages,
  };
}

module.exports = { extractDocxText };
