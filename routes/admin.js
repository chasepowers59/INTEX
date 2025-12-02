const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');

// Protect all admin routes
router.use(isAuthenticated);
router.use(isManager);

router.get('/dashboard', adminController.getDashboard);

module.exports = router;
