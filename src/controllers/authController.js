const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key_antigravity';
const rawExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
const JWT_EXPIRES_IN = /^\d+$/.test(rawExpiresIn) ? parseInt(rawExpiresIn, 10) : rawExpiresIn;

exports.register = async (req, res, next) => {
  const { name, email, password, role, department } = req.body;
  try {
    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (role !== 'admin' && role !== 'employee') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const userExist = await db.query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, department, created_at',
      [name, trimmedEmail, passwordHash, role, department]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Query user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      token_version: user.token_version || 1
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateFcmToken = async (req, res, next) => {
  const { fcmToken } = req.body;
  const userId = req.user.id;
  try {
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }
    await db.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [fcmToken, userId]);
    res.json({ message: 'FCM Token updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.logoutAll = async (req, res, next) => {
  const userId = req.user.id;
  try {
    await db.query('UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = $1', [userId]);
    res.json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    next(error);
  }
};
