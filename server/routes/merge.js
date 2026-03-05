const express = require('express');
const { intelligentPlace } = require('../services/llm');

const router = express.Router();

/**
 * POST /api/merge
 * Intelligently place an element into a target document
 * Body: { targetElements, newElement }
 */
router.post('/merge', async (req, res) => {
  try {
    const { targetElements, newElement } = req.body;

    if (!targetElements || !newElement) {
      return res.status(400).json({ error: 'targetElements and newElement are required' });
    }

    const placement = await intelligentPlace(targetElements, newElement);

    // Insert the element at the determined position
    const updatedElements = [...targetElements];
    const position = Math.min(
      Math.max(0, placement.position),
      updatedElements.length
    );
    
    // Mark the new element as recently added for highlighting
    const insertedElement = {
      ...newElement,
      id: `merged-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      _justInserted: true,
    };
    
    updatedElements.splice(position, 0, insertedElement);

    res.json({
      elements: updatedElements,
      placement: {
        position,
        reason: placement.reason,
      },
    });
  } catch (err) {
    console.error('Merge error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
