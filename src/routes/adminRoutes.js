const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Employee Management
router.get('/employees', authenticateToken, isAdmin, adminController.getEmployees);
router.post('/employees', authenticateToken, isAdmin, adminController.createEmployee);
router.put('/employees/:id', authenticateToken, isAdmin, adminController.updateEmployee);

// Tea Master Management
router.get('/tea-items', authenticateToken, adminController.getTeaItems); // readable by both to display pricing
router.post('/tea-items', authenticateToken, isAdmin, adminController.createTeaItem);
router.put('/tea-items/:id', authenticateToken, isAdmin, adminController.updateTeaItem);

// Settings
router.put('/settings', authenticateToken, isAdmin, adminController.updateSettings);

module.exports = router;
