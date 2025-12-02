const express = require('express');
const router = express.Router();
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');

// List Events
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = db('event_instances')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .select('*')
            // .where('event_date_time_start', '>=', new Date())
            .orderBy('event_date_time_start', 'asc');

        if (search) {
            query = query.where('event_definitions.event_name', 'ilike', `%${search}%`);
        }

        const events = await query;

        // Group events by definition
        const groupedEvents = {};
        events.forEach(event => {
            if (!groupedEvents[event.event_definition_id]) {
                groupedEvents[event.event_definition_id] = {
                    definition: {
                        event_name: event.event_name,
                        event_description: event.event_description,
                        event_recurrence_pattern: event.event_recurrence_pattern,
                        event_type: event.event_type
                    },
                    instances: []
                };
            }
            groupedEvents[event.event_definition_id].instances.push(event);
        });

        res.render('events/list', { user: req.session.user, groupedEvents, search });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Event Form
router.get('/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const templates = await db('event_definitions').select('*');
        res.render('events/form', { user: req.session.user, templates, event: null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Add Event
router.post('/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const { event_definition_id, event_date_time_start, event_date_time_end, event_location, event_capacity } = req.body;
        const eventInstanceId = generateId();

        await db('event_instances').insert({
            event_instance_id: eventInstanceId,
            event_definition_id: event_definition_id,
            event_date_time_start: event_date_time_start,
            event_date_time_end: event_date_time_end,
            event_location: event_location,
            event_capacity: event_capacity
        });

        res.redirect('/events');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Edit Event Form
router.get('/edit/:id', isAuthenticated, isManager, async (req, res) => {
    try {
        const event = await db('event_instances').where({ event_instance_id: req.params.id }).first();
        const templates = await db('event_definitions').select('*');
        res.render('events/form', { user: req.session.user, templates, event });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Edit Event
router.post('/edit/:id', isAuthenticated, isManager, async (req, res) => {
    try {
        const { event_definition_id, event_date_time_start, event_date_time_end, event_location, event_capacity } = req.body;

        await db('event_instances').where({ event_instance_id: req.params.id }).update({
            event_definition_id: event_definition_id,
            event_date_time_start: event_date_time_start,
            event_date_time_end: event_date_time_end,
            event_location: event_location,
            event_capacity: event_capacity
        });

        res.redirect('/events');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Delete Event
router.post('/delete/:id', isAuthenticated, isManager, async (req, res) => {
    try {
        await db('event_instances').where({ event_instance_id: req.params.id }).del();
        res.redirect('/events');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Register for Event (Logged-in User)
router.post('/register/:id', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;

        // Check if user is linked to a participant
        const appUser = await db('app_user').where('user_id', user.user_id).first();

        if (!appUser || !appUser.participant_id) {
            return res.status(400).send('Your account is not linked to a participant profile. Please contact an admin.');
        }

        const registrationId = generateId();

        // Check if already registered
        const existing = await db('registrations')
            .where({ participant_id: appUser.participant_id, event_instance_id: req.params.id })
            .first();

        if (existing) {
            return res.send('<script>alert("You are already registered for this event!"); window.location.href="/events";</script>');
        }

        await db('registrations').insert({
            registration_id: registrationId,
            participant_id: appUser.participant_id,
            event_instance_id: req.params.id,
            registration_status: 'Registered',
            registration_created_at: new Date()
        });

        res.send('<script>alert("Successfully registered!"); window.location.href="/events";</script>');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
