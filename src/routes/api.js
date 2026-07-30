const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const orderController = require('../controllers/orderController');
const adminController = require('../controllers/adminController');
const reportController = require('../controllers/reportController');
const notificationService = require('../services/notificationService');
const cronController = require('../controllers/cronController');

const { authenticateToken, isAdmin, isEmployee } = require('../middleware/auth');

// --- AUTHENTICATION ---
router.post('/login', authController.login);
router.post('/register', authController.register); // User register (admin use)
router.post('/fcm-token', authenticateToken, authController.updateFcmToken);

// --- DASHBOARD ---
router.get('/dashboard', authenticateToken, orderController.getDashboard);

// --- EMPLOYEE MANAGEMENT (Admin Only) ---
router.get('/employees', authenticateToken, isAdmin, adminController.getEmployees);
router.post('/employees', authenticateToken, isAdmin, adminController.createEmployee);
router.put('/employees/:id', authenticateToken, isAdmin, adminController.updateEmployee);
router.delete('/employees/:id', authenticateToken, isAdmin, adminController.deleteEmployee);

// --- TEA ITEM MASTER (Prices & Availability) ---
router.get('/tea-items', authenticateToken, adminController.getTeaItems);
router.post('/tea-items', authenticateToken, isAdmin, adminController.createTeaItem);
router.put('/tea-items/:id', authenticateToken, isAdmin, adminController.updateTeaItem);
router.delete('/tea-items/:id', authenticateToken, isAdmin, adminController.deleteTeaItem);

// --- SETTINGS (Admin Only) ---
router.put('/settings', authenticateToken, isAdmin, adminController.updateSettings);

// --- ORDERS ---
router.post('/order', authenticateToken, isEmployee, orderController.placeOrder);
router.put('/order', authenticateToken, isEmployee, orderController.updateTodayOrder); // Update or Cancel today's order
router.put('/order/:id/cancel', authenticateToken, orderController.cancelOrder);
router.get('/today-orders', authenticateToken, orderController.getTodayOrders);
router.get('/history', authenticateToken, orderController.getOrderHistory);

// --- REPORTS ---
router.get('/monthly-report', authenticateToken, isAdmin, (req, res, next) => {
  // Force report type to be 'monthly'
  req.query.reportType = 'monthly';
  reportController.getReport(req, res, next);
});
router.get('/reports', authenticateToken, isAdmin, reportController.getReport);
router.get('/download-pdf', authenticateToken, isAdmin, reportController.downloadPdf);
router.get('/download-excel', authenticateToken, isAdmin, reportController.downloadExcel);
router.delete('/order/:id', authenticateToken, isAdmin, orderController.deleteOrder);

// --- PUSH NOTIFICATIONS ---
router.post('/send-notification', authenticateToken, isAdmin, notificationService.sendManualNotification);
router.get('/notifications', authenticateToken, notificationService.getUserNotifications);

// --- AUTOMATED CRONS (Vercel/External Scheduler compatibility) ---
router.get('/cron/start', cronController.triggerStart);
router.get('/cron/end', cronController.triggerEnd);
router.get('/cron/tick', cronController.triggerTick);

module.exports = router;
