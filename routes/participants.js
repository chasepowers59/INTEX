const express = require('express');
const router = express.Router();
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { isAuthenticated, isManager } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { generateId } = require('../utils/idGenerator');

// List Participants (with Search & Filters)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const { search, role, city, sort } = req.query;
        let query = db('participants').select('*');

        if (search) {
            query = query.where(builder => {
                builder.where('participant_first_name', 'ilike', `%${search}%`)
                    .orWhere('participant_last_name', 'ilike', `%${search}%`)
                    .orWhere('participant_email', 'ilike', `%${search}%`);
            });
        }

        if (role) {
            query = query.where('participant_role', 'ilike', role);
        }

        if (city) {
            query = query.where('participant_city', 'ilike', city);
        }

        if (sort) {
            const [field, dir] = sort.split(':');
            query = query.orderBy(field, dir || 'asc');
        } else {
            query = query.orderBy('participant_last_name', 'asc');
        }

        console.log('Filter Params:', { search, role, city, sort }); // DEBUG
        console.log('SQL Query:', query.toString()); // DEBUG

        const participants = await query;

        // Fetch distinct values for filters
        const roles = await db('participants').distinct('participant_role').pluck('participant_role');
        const cities = await db('participants').distinct('participant_city').pluck('participant_city');

        res.render('participants/list', {
            user: req.user,
            participants,
            search,
            filters: { role, city, sort },
            options: { roles: roles.filter(Boolean).sort(), cities: cities.filter(Boolean).sort() }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add Participant Form
router.get('/add', isAuthenticated, isManager, (req, res) => {
    res.render('participants/form', { user: req.user, participant: null });
});

// Handle Add with Photo
router.post('/add', isAuthenticated, isManager, upload, async (req, res) => {
    try {
        const participantId = generateId();
        const participantData = {
            participant_id: participantId,
            participant_email: req.body.participant_email,
            participant_first_name: req.body.participant_first_name,
            participant_last_name: req.body.participant_last_name,
            participant_dob: req.body.participant_dob,
            participant_role: req.body.participant_role,
            participant_phone: req.body.participant_phone,
            participant_city: req.body.participant_city,
            participant_state: req.body.participant_state,
            participant_zip: req.body.participant_zip,
            participant_school_or_employer: req.body.participant_school_or_employer,
            participant_field_of_interest: req.body.participant_field_of_interest,
            // college_status: req.body.college_status,
            // degree_type: req.body.degree_type,
            // job_status: req.body.job_status,
            // job_field: req.body.job_field
        };

        await db('participants').insert(participantData);
        res.redirect('/participants');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Participant Detail Dashboard ("One Kid Hub")
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        // Access Control
        const user = req.user;
        const isAuthorized =
            user.participant_role === 'admin' ||
            user.participant_id == req.params.id;

        if (!isAuthorized) {
            return res.status(403).render('error', {
                message: 'You are not authorized to view this profile.',
                error: { status: 403, stack: '' }
            });
        }

        const participant = await db('participants').where({ participant_id: req.params.id }).first();
        if (!participant) return res.status(404).send('Participant not found');

        // Fetch related data
        const milestones = await db('milestones')
            .where({ participant_id: req.params.id })
            .select('*');

        const events = await db('registrations')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .where({ participant_id: req.params.id })
            .select('event_definitions.event_name', 'event_instances.event_date_time_start as start_time', 'event_instances.event_location as location', 'event_definitions.event_type');

        const surveys = await db('surveys')
            .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .where('registrations.participant_id', req.params.id)
            .select('surveys.*', 'event_definitions.event_name');

        const donations = await db('donations')
            .where({ participant_id: req.params.id });

        // Calculate Averages
        let avgSat = 0, avgUse = 0, avgRec = 0;
        if (surveys.length > 0) {
            avgSat = surveys.reduce((acc, s) => acc + parseFloat(s.survey_satisfaction_score || 0), 0) / surveys.length;
            avgUse = surveys.reduce((acc, s) => acc + parseFloat(s.survey_usefulness_score || 0), 0) / surveys.length;
            avgRec = surveys.reduce((acc, s) => acc + parseFloat(s.survey_recommendation_score || 0), 0) / surveys.length;
        }

        res.render('participants/detail', {
            user: req.user,
            participant,
            milestones,
            registrations: events, // View expects 'registrations' for the event list
            surveys,
            donations,
            averages: {
                satisfaction: avgSat.toFixed(1),
                usefulness: avgUse.toFixed(1),
                recommendation: avgRec.toFixed(1)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Edit Participant Form
router.get('/edit/:id', isAuthenticated, isManager, async (req, res) => {
    try {
        const participant = await db('participants').where({ participant_id: req.params.id }).first();
        res.render('participants/form', { user: req.user, participant });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Edit with Photo
router.post('/edit/:id', isAuthenticated, isManager, upload, async (req, res) => {
    try {
        const participantData = {
            participant_email: req.body.participant_email,
            participant_first_name: req.body.participant_first_name,
            participant_last_name: req.body.participant_last_name,
            participant_dob: req.body.participant_dob,
            participant_role: req.body.participant_role,
            participant_phone: req.body.participant_phone,
            participant_city: req.body.participant_city,
            participant_state: req.body.participant_state,
            participant_zip: req.body.participant_zip,
            participant_school_or_employer: req.body.participant_school_or_employer,
            participant_field_of_interest: req.body.participant_field_of_interest,
            // college_status: req.body.college_status,
            // degree_type: req.body.degree_type,
            // job_status: req.body.job_status,
            // job_field: req.body.job_field
        };

        await db('participants').where({ participant_id: req.params.id }).update(participantData);
        res.redirect(`/participants/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle Delete
router.post('/delete/:id', isAuthenticated, isManager, async (req, res) => {
    try {
        await db('participants').where({ participant_id: req.params.id }).del();
        res.redirect('/participants');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
