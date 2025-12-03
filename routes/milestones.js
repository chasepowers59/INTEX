const express = require('express');
const router = express.Router();
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');

const { generateId } = require('../utils/idGenerator');

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
router.post('/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const { participant_id, milestone_title, milestone_date } = req.body;
        const milestoneId = generateId();

        await db('milestones').insert({
            milestone_id: milestoneId,
            participant_id: participant_id,
            milestone_title: milestone_title,
            milestone_date: milestone_date
        });

        res.redirect(`/participants/${participant_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- TEMPLATES ---

// List Templates
router.get('/templates', isAuthenticated, isManager, async (req, res) => {
    try {
        const templates = await db('milestone_templates').orderBy('created_at', 'desc');
        res.render('milestones/templates', { user: req.user, templates });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Template Form
router.get('/templates/add', isAuthenticated, isManager, (req, res) => {
    res.render('milestones/add_template', { user: req.user });
});

// Handle Add Template
router.post('/templates/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const { title, description, days_from_start } = req.body;
        await db('milestone_templates').insert({
            title,
            description,
            days_from_start: days_from_start || 0
        });
        res.redirect('/milestones/templates');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
