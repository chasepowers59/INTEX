const express = require('express');
const router = express.Router();
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');

const { generateId } = require('../utils/idGenerator');

// Donation Insights
router.get('/insights', isAuthenticated, isManager, async (req, res) => {
    try {
        // Top Donors
        // Business Logic: Only include donations with valid dates (not null, not in the future) and valid amounts
        // Use INNER JOIN to only show donors who are registered participants (excludes visitor donations)
        // This ensures consistency with the dashboard calculation
        const nowForTopDonors = new Date();
        const topDonors = await db('donations')
            .join('participants', 'donations.participant_id', 'participants.participant_id')
            .whereNotNull('donations.donation_date')
            .whereNotNull('donations.donation_amount')
            .where('donations.donation_date', '<=', nowForTopDonors) // Don't include future dates
            .select(
                'participants.participant_first_name',
                'participants.participant_last_name',
                db.raw('SUM(donations.donation_amount) as total_amount'),
                db.raw('COUNT(donations.donation_id) as donation_count'),
                db.raw('MAX(donations.donation_date) as last_donation')
            )
            .groupBy('participants.participant_id', 'participants.participant_first_name', 'participants.participant_last_name')
            .orderBy('total_amount', 'desc')
            .limit(10);

        // Overall Stats
        // Business Logic: Match the dashboard KPI calculation logic
        // Only count donations with valid dates (not null, not in the future) and valid amounts
        // This ensures consistency between dashboard KPI and insights page
        const nowForDonations = new Date();
        const stats = await db('donations')
            .whereNotNull('donation_date')
            .whereNotNull('donation_amount')
            .where('donation_date', '<=', nowForDonations) // Don't include future dates
            .sum('donation_amount as totalRaised')
            .count('donation_id as totalDonations')
            .first();

        const totalRaised = stats.totalRaised || 0;
        const totalDonations = stats.totalDonations || 0;
        const avgDonation = totalDonations > 0 ? (totalRaised / totalDonations).toFixed(2) : 0;

        res.render('donations/insights', {
            user: req.user,
            topDonors,
            totalRaised,
            totalDonations,
            avgDonation
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// List Donations - Redirect to admin donations page
// Business Logic: The old /donations route is deprecated in favor of /admin/donations
// which has better styling and functionality. This redirect ensures users always
// see the improved admin interface.
router.get('/', isAuthenticated, isManager, async (req, res) => {
    // Preserve query parameters (like search) when redirecting
    const queryString = req.query.search ? `?search=${encodeURIComponent(req.query.search)}` : '';
    res.redirect(`/admin/donations${queryString}`);
});

// Add Donation Form - Redirect to admin donations add page
router.get('/add', isAuthenticated, isManager, async (req, res) => {
    res.redirect('/admin/donations/add');
});

// Handle Add Donation - Redirect to admin donations add page
router.post('/add', isAuthenticated, isManager, async (req, res) => {
    // This route is deprecated - redirect to admin route
    res.redirect('/admin/donations/add');
});

module.exports = router;
