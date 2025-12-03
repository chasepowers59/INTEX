const express = require('express');
const router = express.Router();
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');

// Event Impact Insights
router.get('/insights', isAuthenticated, isManager, async (req, res) => {
    try {
        // 1. Prepare Base Data: Participant Stats (Event Count & Milestone Count)
        // We need a subquery or CTE approach. Knex makes this a bit verbose, so we'll do it in steps or raw.
        // Let's use a raw query for the aggregation to be efficient.

        const participantStats = await db.raw(`
            SELECT 
                p.participant_id,
                p.participant_first_name,
                p.participant_last_name,
                COUNT(DISTINCT r.registration_id) as event_count,
                COUNT(DISTINCT m.milestone_id) as milestone_count
            FROM participants p
            LEFT JOIN registrations r ON p.participant_id = r.participant_id
            LEFT JOIN milestones m ON p.participant_id = m.participant_id
            GROUP BY p.participant_id, p.participant_first_name, p.participant_last_name
        `);

        const stats = participantStats.rows || participantStats; // Handle different Knex/PG return formats

        // 2. Process Correlation Data (Buckets)
        const buckets = {
            '0 Events': { count: 0, totalMilestones: 0 },
            '1-2 Events': { count: 0, totalMilestones: 0 },
            '3-5 Events': { count: 0, totalMilestones: 0 },
            '6+ Events': { count: 0, totalMilestones: 0 }
        };

        stats.forEach(p => {
            const ec = parseInt(p.event_count);
            const mc = parseInt(p.milestone_count);
            let bucketKey = '0 Events';
            if (ec >= 6) bucketKey = '6+ Events';
            else if (ec >= 3) bucketKey = '3-5 Events';
            else if (ec >= 1) bucketKey = '1-2 Events';

            buckets[bucketKey].count++;
            buckets[bucketKey].totalMilestones += mc;
        });

        const correlationData = Object.keys(buckets).map(key => ({
            bucket: key,
            avg_milestones: buckets[key].count > 0 ? (buckets[key].totalMilestones / buckets[key].count).toFixed(2) : 0
        }));

        // 3. Needs Encouragement (Low Events, Low Milestones)
        const needsEncouragement = stats
            .filter(p => parseInt(p.event_count) < 3 && parseInt(p.milestone_count) < 2)
            .sort((a, b) => parseInt(a.event_count) - parseInt(b.event_count)) // Lowest events first
            .slice(0, 5);

        // 4. Success Stories (High Events, High Milestones)
        const successStories = stats
            .filter(p => parseInt(p.event_count) >= 3 && parseInt(p.milestone_count) >= 2)
            .sort((a, b) => parseInt(b.milestone_count) - parseInt(a.milestone_count)) // Highest milestones first
            .slice(0, 5);

        res.render('events/insights', {
            user: req.user,
            correlationData,
            needsEncouragement,
            successStories
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// List Events
router.get('/', async (req, res) => {
    try {
        const { search, eventType } = req.query;
        let query = db('event_instances')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .select('*')
            // .where('event_date_time_start', '>=', new Date())
            .orderBy('event_date_time_start', 'asc');

        if (search) {
            query = query.where('event_definitions.event_name', 'ilike', `%${search}%`);
        }

        // Filter by event type if provided (from programs page)
        if (eventType) {
            query = query.where('event_definitions.event_type', eventType);
        }

        const events = await query;

        // Debug: Log what we found
        console.log('Events query returned:', events.length, 'events');
        if (eventType) {
            console.log('Filtered by eventType:', eventType);
        }

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

        console.log('Grouped into', Object.keys(groupedEvents).length, 'event definitions');

        res.render('events/list', { user: req.user, groupedEvents, search, eventType });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Create Definition Form
router.get('/definitions/add', isAuthenticated, isManager, (req, res) => {
    res.render('events/definition_form', { user: req.user });
});

// Handle Create Definition
router.post('/definitions/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const { event_name, event_type, event_description, event_recurrence_pattern, event_default_capacity } = req.body;
        const definitionId = generateId();

        await db('event_definitions').insert({
            event_definition_id: definitionId,
            event_name,
            event_type,
            event_description,
            event_recurrence_pattern: event_recurrence_pattern || null,
            event_default_capacity: event_default_capacity || 30
        });

        res.redirect('/events/add'); // Redirect to add instance using this new definition
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Event Form
router.get('/add', isAuthenticated, isManager, async (req, res) => {
    try {
        const templates = await db('event_definitions').select('*');
        res.render('events/form', { user: req.user, templates, event: null });
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
        res.render('events/form', { user: req.user, templates, event });
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
        const user = req.user;

        // User is now a participant, so use participant_id directly
        if (!user.participant_id) {
            return res.status(400).send('Your account is not linked to a participant profile. Please contact an admin.');
        }

        const registrationId = generateId();

        // Check if already registered
        const existing = await db('registrations')
            .where({ participant_id: user.participant_id, event_instance_id: req.params.id })
            .first();

        if (existing) {
            return res.send('<script>alert("You are already registered for this event!"); window.location.href="/events";</script>');
        }

        await db('registrations').insert({
            registration_id: registrationId,
            participant_id: user.participant_id,
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

// Register for Event (Visitor - Not Logged In)
// Business Logic: Similar to visitor donations, allow visitors to register for events
// by creating a participant record if needed, then registering them for the event
router.post('/register-visitor', async (req, res) => {
    try {
        const { event_instance_id, first_name, last_name, email } = req.body;

        if (!event_instance_id || !first_name || !last_name || !email) {
            return res.status(400).send('All fields are required.');
        }

        // Check if participant exists by email
        let participantId = null;
        const existingParticipant = await db('participants')
            .where('participant_email', email)
            .first();

        if (existingParticipant) {
            participantId = existingParticipant.participant_id;
        } else {
            // Create new participant record for visitor
            participantId = generateId();
            await db('participants').insert({
                participant_id: participantId,
                participant_email: email,
                participant_first_name: first_name,
                participant_last_name: last_name,
                participant_role: 'participant', // Default role for visitor-created accounts
                // Other fields left null as visitor only provides registration info
            });
        }

        // Check if already registered for this event
        const existingRegistration = await db('registrations')
            .where({ participant_id: participantId, event_instance_id: event_instance_id })
            .first();

        if (existingRegistration) {
            return res.send('<script>alert("You are already registered for this event!"); window.location.href="/events";</script>');
        }

        // Create registration
        const registrationId = generateId();
        await db('registrations').insert({
            registration_id: registrationId,
            participant_id: participantId,
            event_instance_id: event_instance_id,
            registration_status: 'Registered',
            registration_created_at: new Date()
        });

        res.send('<script>alert("Successfully registered! You can now log in with your email to manage your registrations."); window.location.href="/events";</script>');
    } catch (err) {
        console.error('Visitor Registration Error:', err);
        res.status(500).send('Error processing registration. Please try again.');
    }
});

module.exports = router;
