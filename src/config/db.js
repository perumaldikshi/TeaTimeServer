const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const isProduction = process.env.NODE_ENV === 'production';
const isNeon = connectionString && connectionString.includes('neon.tech');

const pool = new Pool({
  connectionString,
  // Force SSL for Neon databases or production environments
  ssl: isNeon || isProduction ? { rejectUnauthorized: false } : false
});

// Test connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL Database pool.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};


// const bcrypt = require('bcryptjs');
// const db = require('./src/config/db');

// async function reset() {
//   const hash = await bcrypt.hash('admin123', 10);
//   await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@teatime.com']);
//   console.log('Password reset successfully to admin123');
//   process.exit(0);
// }

// reset().catch(console.error);
