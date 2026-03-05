const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * DISABLED - Registration is closed. Use the seed script to create admin accounts.
 */
router.post('/auth/register', (req, res) => {
  return res.status(403).json({ error: 'Registration is currently disabled' });
});

/**
 * POST /api/auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const token = generateToken(userData);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: userData, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 */
router.get('/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
