const db = require('../config/db');
let admin = null;

try {
  const fs = require('fs');
  const path = require('path');
  require('dotenv').config();

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 'firebase-service-account.json';
  const fullPath = path.isAbsolute(serviceAccountPath) 
    ? serviceAccountPath 
    : path.join(process.cwd(), serviceAccountPath);

  if (fs.existsSync(fullPath)) {
    admin = require('firebase-admin');
    const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } else {
    console.warn(`Firebase Service Account file not found at: ${fullPath} - Push notifications will run in MOCK Mode.`);
  }
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err.message, '- Push notifications will run in MOCK Mode.');
}

// Send push notification helper
exports.sendPushNotification = async (title, body, userId = null) => {
  try {
    // 1. Record notification in DB for history screen
    await db.query(
      'INSERT INTO notifications (title, body, user_id) VALUES ($1, $2, $3)',
      [title, body, userId]
    );

    // 2. Fetch FCM tokens from DB
    let tokens = [];
    if (userId) {
      const res = await db.query('SELECT fcm_token FROM users WHERE id = $1 AND is_active = true', [userId]);
      if (res.rows.length > 0 && res.rows[0].fcm_token) {
        tokens.push(res.rows[0].fcm_token);
      }
    } else {
      const res = await db.query('SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND is_active = true');
      tokens = res.rows.map(r => r.fcm_token);
    }

    if (tokens.length === 0) {
      console.log(`[Notification Service] Logged notification: "${title}" - "${body}" (0 target device tokens).`);
      return { success: true, message: 'Notification logged, but no FCM tokens found.' };
    }

    if (admin) {
      const message = {
        notification: { title, body },
        tokens: tokens
      };
      
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`[Notification Service] Sent via FCM. Success: ${response.successCount}, Failures: ${response.failureCount}`);
      return { success: true, response };
    } else {
      console.log(`[Notification Service Mock] Title: "${title}", Body: "${body}", Tokens Count: ${tokens.length}`);
      return { success: true, mock: true, message: 'Logged and sent in mock console mode.' };
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
};

// API handler to fetch notification history
exports.getUserNotifications = async (req, res, next) => {
  const userId = req.user.id;
  try {
    // Fetch notifications targetted to this user specifically OR targetted to everyone (null user_id)
    const result = await db.query(
      `SELECT id, title, body, sent_at 
       FROM notifications 
       WHERE user_id = $1 OR user_id IS NULL 
       ORDER BY sent_at DESC 
       LIMIT 50`,
      [userId]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    next(error);
  }
};

// Admin manually sending push notifications
exports.sendManualNotification = async (req, res, next) => {
  const { title, body, userId } = req.body;
  try {
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and Body are required fields' });
    }

    const targetUserId = userId ? parseInt(userId) : null;
    const result = await this.sendPushNotification(title, body, targetUserId);

    res.json({
      message: 'Notification trigger completed',
      result
    });
  } catch (error) {
    next(error);
  }
};
