const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key_antigravity';

const authenticateToken = (req, res, next) => {
  let token;
  const authHeader = req.headers['authorization'];
  
  if (authHeader) {
    token = authHeader.split(' ')[1];
  } else if (req.query) {
    if (req.query.token) {
      token = req.query.token;
    } else if (req.query.Authorization) {
      const parts = req.query.Authorization.split(' ');
      token = parts[1] || parts[0];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired' });
    }

    try {
      const db = require('../config/db');
      const userRes = await db.query('SELECT token_version, is_active FROM users WHERE id = $1', [decoded.id]);
      
      if (userRes.rows.length === 0) {
        return res.status(403).json({ error: 'User not found' });
      }

      const user = userRes.rows[0];
      if (!user.is_active) {
        return res.status(403).json({ error: 'User account is deactivated' });
      }

      if (decoded.token_version !== undefined && decoded.token_version !== user.token_version) {
        return res.status(401).json({ error: 'Session expired or logged out from all devices' });
      }

      req.user = decoded;
      next();
    } catch (dbErr) {
      console.error('Middleware database auth error:', dbErr);
      return res.status(500).json({ error: 'Authentication failed due to server error' });
    }
  });
};

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
};

const isEmployee = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role !== 'employee' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Employee privileges required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  isAdmin,
  isEmployee
};
