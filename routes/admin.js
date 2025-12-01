const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');

// Protect all admin routes
router.use(isAuthenticated);
router.use(isManager);

router.get('/dashboard', adminController.getDashboard);
router.get('/participants', adminController.getParticipants);
router.get('/events', adminController.getEvents);
router.get('/participant/:id', adminController.getParticipantDetail);

// Forms
router.get('/donation/add', adminController.getAddDonation);
router.post('/donation/add', adminController.postAddDonation);

router.get('/milestone/add', adminController.getAddMilestone);
router.post('/milestone/add', adminController.postAddMilestone);

module.exports = router;
