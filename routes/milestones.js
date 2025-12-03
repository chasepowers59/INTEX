const express = require('express');
const router = express.Router();
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');

const { generateId } = require('../utils/idGenerator');

// Debug route to verify milestone routes are loaded
router.get('/test', (req, res) => {
    res.send('Milestone routes are working!');
});

// Add Milestone Form
router.get('/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const participants = await db('participants').select('participant_id', 'participant_first_name', 'participant_last_name');
        const templates = await db('milestone_templates').orderBy('title', 'asc');
        res.render('milestones/form', { user: req.user, participants, templates });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Add Milestone
router.post('/add', isAuthenticated, async (req, res) => {
    try {
        console.log('POST /milestones/add - Request received');
        console.log('User:', req.user ? req.user.participant_id : 'No user');
        console.log('Body:', req.body);
        
        const { participant_id, milestone_title, milestone_date } = req.body;

        if (!participant_id || !milestone_title || !milestone_date) {
            return res.status(400).send('Missing required fields: participant_id, milestone_title, milestone_date');
        }

        // Access Control: Admin or Owner
        if (req.user.participant_role !== 'admin' && req.user.participant_role !== 'manager' && req.user.participant_id != participant_id) {
            console.log('Access denied - user ID mismatch');
            return res.status(403).send('Unauthorized: You can only add milestones for yourself');
        }

        const milestoneId = generateId();

        await db('milestones').insert({
            milestone_id: milestoneId,
            participant_id: participant_id,
            milestone_title: milestone_title,
            milestone_date: milestone_date
        });

        console.log('Milestone added successfully:', milestoneId);
        
        // Redirect back to referring page, or to participant profile if no referer
        const referer = req.get('referer') || `/participants/${participant_id}`;
        res.redirect(referer);
    } catch (err) {
        console.error('Add Milestone Error:', err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// Handle Edit Milestone
router.post('/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { milestone_title, milestone_date } = req.body;

        const milestone = await db('milestones').where({ milestone_id: id }).first();
        if (!milestone) return res.status(404).send('Milestone not found');

        // Access Control: Admin or Owner
        if (req.user.participant_role !== 'admin' && req.user.participant_role !== 'manager' && req.user.participant_id != milestone.participant_id) {
            return res.status(403).send('Unauthorized');
        }

        await db('milestones')
            .where({ milestone_id: id })
            .update({
                milestone_title,
                milestone_date
            });

        res.redirect(req.get('referer'));
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Delete Milestone
router.post('/delete/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const milestone = await db('milestones').where({ milestone_id: id }).first();

        if (!milestone) return res.status(404).send('Milestone not found');

        // Access Control: Admin or Owner
        if (req.user.participant_role !== 'admin' && req.user.participant_role !== 'manager' && req.user.participant_id != milestone.participant_id) {
            return res.status(403).send('Unauthorized');
        }

        await db('milestones').where({ milestone_id: id }).del();
        res.redirect(req.get('referer'));
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
