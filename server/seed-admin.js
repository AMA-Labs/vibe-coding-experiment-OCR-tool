/**
 * Seed script to create an admin user.
 * Usage: node server/seed-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const ADMIN_EMAIL = 'admin@ocr-canvas.com';
const ADMIN_PASSWORD = 'admin2024!';
const ADMIN_NAME = 'Admin';

async function seed() {
  console.log('Seeding admin user...');

  // Check if already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (existing) {
    console.log(`User ${ADMIN_EMAIL} already exists (id: ${existing.id}). Updating password...`);
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(ADMIN_PASSWORD, salt);
    db.prepare('UPDATE users SET password = ?, name = ? WHERE email = ?').run(hash, ADMIN_NAME, ADMIN_EMAIL);
    console.log('Password updated.');
  } else {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(ADMIN_PASSWORD, salt);
    const result = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(ADMIN_EMAIL, hash, ADMIN_NAME);
    console.log(`Admin user created (id: ${result.lastInsertRowid})`);
  }

  console.log(`\n  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}\n`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
