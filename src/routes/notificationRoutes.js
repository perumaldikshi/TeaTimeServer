const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { authenticateToken, isAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, notificationService.getUserNotifications);
router.post('/send', authenticateToken, isAdmin, notificationService.sendManualNotification);

module.exports = router;
