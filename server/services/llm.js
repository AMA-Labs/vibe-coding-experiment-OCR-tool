const OpenAI = require('openai');

let openai = null;

function getClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Please add it to your .env file.');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Extract structured elements from raw PDF text using LLM
 */
async function extractElementsFromText(text, filename) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a document structure analyzer. Given raw text extracted from a PDF, break it down into semantic elements. Each element should be one of these types: heading, paragraph, list, table, quote, code, metadata.

Return a JSON array of elements, each with:
- "type": one of the types above
- "content": the text content of that element
- "label": a short human-readable label/summary (max 60 chars)

Be thorough — capture ALL content from the document. Preserve the original text faithfully. Group related content logically.

Return ONLY valid JSON, no markdown fences.`
      },
      {
        role: 'user',
        content: `Extract structured elements from this document "${filename}":\n\n${text.slice(0, 30000)}`
      }
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const content = response.choices[0].message.content.trim();
  try {
    // Try to parse, stripping markdown fences if present
    const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse LLM response:', content);
    // Fallback: return the whole text as a single element
    return [{
      type: 'paragraph',
      content: text.slice(0, 5000),
      label: 'Full document text'
    }];
  }
}

/**
 * Run OCR on an image using GPT-4 Vision
 */
async function ocrImage(base64Image, mimeType, filename) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an OCR engine. Extract ALL text and visual content from this image. Break the content into semantic elements.

Return a JSON array of elements, each with:
- "type": one of heading, paragraph, list, table, quote, code, metadata, caption
- "content": the extracted text content
- "label": a short human-readable label/summary (max 60 chars)

Be thorough — capture everything visible. Preserve formatting and structure.

Return ONLY valid JSON, no markdown fences.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Run OCR on this image "${filename}" and extract all structured elements.`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const content = response.choices[0].message.content.trim();
  try {
    const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Vision OCR response:', content);
    return [{
      type: 'paragraph',
      content: content,
      label: 'OCR extracted text'
    }];
  }
}

/**
 * Intelligently place an element into a target document's element list
 */
async function intelligentPlace(targetElements, newElement) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a document editor AI. Given an existing document structure (as a JSON array of elements) and a new element to insert, determine the best position to place it.

Consider:
- Document flow and logical ordering
- The type and content of surrounding elements
- Headings should come before their related content
- Maintain coherent document structure

Return a JSON object with:
- "position": the 0-based index where the new element should be inserted
- "reason": a brief explanation of why this position was chosen

Return ONLY valid JSON, no markdown fences.`
      },
      {
        role: 'user',
        content: `Current document elements:\n${JSON.stringify(targetElements, null, 2)}\n\nNew element to insert:\n${JSON.stringify(newElement, null, 2)}`
      }
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  const content = response.choices[0].message.content.trim();
  try {
    const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse placement response:', content);
    return { position: targetElements.length, reason: 'Appended to end (fallback)' };
  }
}

/**
 * AI Fill: Use connected elements as context to generate content for a target document
 */
async function aiFill(targetElements, connectedElements, instruction) {
  const client = getClient();

  const connectedContext = connectedElements.map((el, i) =>
    `[Connected Element ${i + 1}] Type: ${el.type}, Label: "${el.label}"\nContent: ${el.content}`
  ).join('\n\n');

  const targetContext = targetElements.length > 0
    ? `Current document structure:\n${JSON.stringify(targetElements.map(el => ({ type: el.type, label: el.label, content: el.content?.slice(0, 200) })), null, 2)}`
    : 'The target document is currently empty.';

  const userInstruction = instruction
    ? `\n\nUser instruction: ${instruction}`
    : '';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a document rewriter/composer AI. You are given connected source elements (context/reference material) and a target document. Your job is to REWRITE and RECOMPOSE the target document using the connected elements as source material.

This is not just insertion — you should:
- Completely rewrite and restructure the target document
- Weave in information from the connected source elements naturally
- Create a cohesive, well-structured document from all available material
- Use proper document structure (headings, paragraphs, lists, etc.)
- If the target is empty, compose a complete new document from the source elements
- If the target has content, rewrite it incorporating the new material seamlessly
- Be thorough — produce a complete, polished document

Return a JSON object with:
- "elements": array of ALL elements for the recomposed document, each with type, content, and label
- "summary": brief description of what was rewritten/composed

Return ONLY valid JSON, no markdown fences.`
      },
      {
        role: 'user',
        content: `${targetContext}\n\nConnected source elements:\n${connectedContext}${userInstruction}\n\nGenerate content for the target document based on the connected elements.`
      }
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const content = response.choices[0].message.content.trim();
  try {
    const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
    const parsed = JSON.parse(cleaned);
    // Add IDs to elements
    parsed.elements = (parsed.elements || []).map((el, idx) => ({
      ...el,
      id: `filled-${Date.now()}-${idx}`,
      _justInserted: true,
    }));
    return parsed;
  } catch (e) {
    console.error('Failed to parse AI fill response:', content);
    return {
      elements: targetElements,
      summary: 'Failed to generate content (parse error)',
    };
  }
}

module.exports = { extractElementsFromText, ocrImage, intelligentPlace, aiFill };
