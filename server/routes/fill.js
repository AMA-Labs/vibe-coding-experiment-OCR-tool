const express = require('express');
const { aiFill } = require('../services/llm');

const router = express.Router();

/**
 * POST /api/fill
 * Use connected elements as context to generate/fill content in a target document
 * Body: { targetElements, connectedElements, instruction }
 */
router.post('/fill', async (req, res) => {
  try {
    const { targetElements, connectedElements, instruction } = req.body;

    if (!connectedElements || connectedElements.length === 0) {
      return res.status(400).json({ error: 'At least one connected element is required' });
    }

    const result = await aiFill(targetElements || [], connectedElements, instruction);

    res.json(result);
  } catch (err) {
    console.error('Fill error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
