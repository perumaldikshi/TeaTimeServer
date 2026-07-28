const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, isEmployee } = require('../middleware/auth');

router.get('/dashboard', authenticateToken, orderController.getDashboard);
router.post('/order', authenticateToken, isEmployee, orderController.placeOrder);
router.put('/order/:id/cancel', authenticateToken, orderController.cancelOrder);
router.get('/today-orders', authenticateToken, orderController.getTodayOrders);
router.get('/history', authenticateToken, orderController.getOrderHistory);

module.exports = router;
