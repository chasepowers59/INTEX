const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');

// Protect all admin routes
router.use(isAuthenticated);
router.use(isManager);

router.get('/dashboard', adminController.getDashboard);

// ==================== USER MAINTENANCE ====================
router.get('/users', adminController.listUsers);
router.post('/users/:participant_id/role', adminController.updateUserRole);
router.post('/users/:participant_id/reset-password', adminController.resetUserPassword);

// ==================== PARTICIPANT MAINTENANCE ====================
router.get('/participants', adminController.listParticipants);
router.get('/participants/edit/:id', adminController.getEditParticipant);
router.post('/participants/edit/:id', adminController.postEditParticipant);

// ==================== EVENT MAINTENANCE ====================
router.get('/events', adminController.listEvents);
router.get('/events/add', adminController.getAddEvent);
router.post('/events/add', adminController.postAddEvent);
router.get('/events/edit/:id', adminController.getEditEvent);
router.post('/events/edit/:id', adminController.postEditEvent);
router.post('/events/delete/:id', adminController.deleteEvent);

// ==================== SURVEY MAINTENANCE ====================
router.get('/surveys', adminController.listSurveys);
router.get('/surveys/:id', adminController.getSurveyDetail);
router.post('/surveys/delete/:id', adminController.deleteSurvey);

// ==================== MILESTONE MAINTENANCE ====================
router.get('/milestones', adminController.listMilestones);
router.get('/milestones/add', adminController.getAddMilestone);
router.post('/milestones/add', adminController.postAddMilestone);
router.get('/milestones/edit/:id', adminController.getEditMilestone);
router.post('/milestones/edit/:id', adminController.postEditMilestone);
router.post('/milestones/delete/:id', adminController.deleteMilestone);

// ==================== DONATION MAINTENANCE ====================
router.get('/donations', adminController.listDonations);
router.get('/donations/add', adminController.getAddDonation);
router.post('/donations/add', adminController.postAddDonation);
router.get('/donations/edit/:id', adminController.getEditDonation);
router.post('/donations/edit/:id', adminController.postEditDonation);
router.post('/donations/delete/:id', adminController.deleteDonation);

module.exports = router;
