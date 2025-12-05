const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isManager, isReadOnlyOrManager } = require('../middleware/authMiddleware');

// Role-Based Access Control Implementation
// All admin routes require authentication
// GET routes (read operations) are accessible to all authenticated users (read-only for common users)
// POST/PUT/DELETE routes (write operations) require manager (admin) role
router.use(isAuthenticated);
router.use(isReadOnlyOrManager);

router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard/data', adminController.getDashboardData);

// ==================== USER MAINTENANCE ====================
router.get('/users', adminController.listUsers);
router.get('/users/edit/:participant_id', isManager, adminController.getEditUser);
router.post('/users/edit/:participant_id', isManager, adminController.postEditUser);
router.post('/users/:participant_id/role', isManager, adminController.updateUserRole);
router.post('/users/:participant_id/reset-password', isManager, adminController.resetUserPassword);
router.post('/users/delete/:participant_id', isManager, adminController.deleteUser);

// ==================== PARTICIPANT MAINTENANCE ====================
router.get('/participants', adminController.listParticipants);
router.get('/participants/add', isManager, adminController.getAddParticipant);
router.post('/participants/add', isManager, adminController.postAddParticipant);
router.get('/participants/edit/:id', isManager, adminController.getEditParticipant);
router.post('/participants/edit/:id', isManager, adminController.postEditParticipant);
router.post('/participants/delete/:id', isManager, adminController.deleteParticipant);

// ==================== REGISTRATION MAINTENANCE ====================
router.get('/registrations', adminController.listRegistrations);

// ==================== EVENT MAINTENANCE ====================
router.get('/events', adminController.listEvents);
router.get('/events/add', isManager, adminController.getAddEvent);
router.post('/events/add', isManager, adminController.postAddEvent);
router.get('/events/edit/:id', isManager, adminController.getEditEvent);
router.post('/events/edit/:id', isManager, adminController.postEditEvent);
router.post('/events/delete/:id', isManager, adminController.deleteEvent);

// ==================== SURVEY MAINTENANCE ====================
router.get('/surveys', adminController.listSurveys);
router.get('/surveys/:id', adminController.getSurveyDetail);
router.get('/surveys/edit/:id', isManager, adminController.getEditSurvey);
router.post('/surveys/edit/:id', isManager, adminController.postEditSurvey);
router.post('/surveys/delete/:id', isManager, adminController.deleteSurvey);

// ==================== MILESTONE MAINTENANCE ====================
router.get('/milestones', adminController.listMilestones);
router.get('/milestones/add', isManager, adminController.getAddMilestone);
router.post('/milestones/add', isManager, adminController.postAddMilestone);
router.get('/milestones/edit/:id', isManager, adminController.getEditMilestone);
router.post('/milestones/edit/:id', isManager, adminController.postEditMilestone);
router.post('/milestones/delete/:id', isManager, adminController.deleteMilestone);

// ==================== DONATION MAINTENANCE ====================
router.get('/donations', adminController.listDonations);
router.get('/donations/add', isManager, adminController.getAddDonation);
router.post('/donations/add', isManager, adminController.postAddDonation);
router.get('/donations/edit/:id', isManager, adminController.getEditDonation);
router.post('/donations/edit/:id', isManager, adminController.postEditDonation);
router.get('/donations/:id', adminController.getDonationDetail);
router.post('/donations/delete/:id', isManager, adminController.deleteDonation);

module.exports = router;
