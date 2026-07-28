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
