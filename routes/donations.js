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
        const topDonors = await db('donations')
            .join('participants', 'donations.participant_id', 'participants.participant_id')
            .select(
                'participants.participant_first_name',
                'participants.participant_last_name',
                db.raw('SUM(donation_amount) as total_amount'),
                db.raw('COUNT(donation_id) as donation_count'),
                db.raw('MAX(donation_date) as last_donation')
            )
            .groupBy('participants.participant_id', 'participants.participant_first_name', 'participants.participant_last_name')
            .orderBy('total_amount', 'desc')
            .limit(10);

        // Overall Stats
        const stats = await db('donations')
            .sum('donation_amount as totalRaised')
            .count('donation_id as totalDonations')
            .first();

        const totalRaised = stats.totalRaised || 0;
        const totalDonations = stats.totalDonations || 0;
        const avgDonation = totalDonations > 0 ? (totalRaised / totalDonations).toFixed(2) : 0;

        res.render('donations/insights', {
            user: req.session.user,
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

// List Donations
router.get('/', isAuthenticated, isManager, async (req, res) => {
    try {
        const { search } = req.query;
        let query = db('donations')
            .leftJoin('participants', 'donations.participant_id', 'participants.participant_id')
            .select('donations.*', 'participants.participant_first_name', 'participants.participant_last_name')
            .orderBy('donation_date', 'desc');

        if (search) {
            query = query.where('participants.participant_first_name', 'ilike', `%${search}%`)
                .orWhere('participants.participant_last_name', 'ilike', `%${search}%`);
        }

        const donations = await query;

        res.render('donations/list', { user: req.session.user, donations, search });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Donation Form
router.get('/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const participants = await db('participants').select('participant_id', 'participant_first_name', 'participant_last_name');
        res.render('donations/form', { user: req.session.user, participants });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Add Donation
router.post('/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const { participant_id, donation_amount, donation_date } = req.body;
        const donationId = generateId();

        await db('donations').insert({
            donation_id: donationId,
            participant_id: participant_id || null,
            donation_amount: donation_amount,
            donation_date: donation_date
        });

        res.redirect('/donations');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
