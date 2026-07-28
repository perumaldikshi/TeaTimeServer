const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, isAdmin, reportController.getReport);
router.get('/download-pdf', authenticateToken, isAdmin, reportController.downloadPdf);
router.get('/download-excel', authenticateToken, isAdmin, reportController.downloadExcel);

module.exports = router;
