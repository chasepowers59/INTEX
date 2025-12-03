const express = require('express');
const router = express.Router();
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { isAuthenticated } = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');

// Get Survey Form (for a specific registration)
router.get('/new/:registrationId', async (req, res) => {
    try {
        const registration = await db('registrations')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .where('registrations.registration_id', req.params.registrationId)
            .select('event_definitions.event_name', 'registrations.registration_id')
            .first();

        if (!registration) {
            return res.status(404).send('Registration not found');
        }

        res.render('surveys/form', { user: req.user, registration });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Post Survey
router.post('/new', async (req, res) => {
    try {
        const { registration_id, satisfaction, usefulness, instructor, recommendation, comments } = req.body;
        const surveyId = generateId();

        // Calculate overall score (simple average)
        const overall = (parseFloat(satisfaction) + parseFloat(usefulness) + parseFloat(instructor) + parseFloat(recommendation)) / 4;

        await db('surveys').insert({
            survey_id: surveyId,
            registration_id,
            survey_satisfaction_score: satisfaction,
            survey_usefulness_score: usefulness,
            survey_instructor_score: instructor,
            survey_recommendation_score: recommendation,
            survey_overall_score: overall,
            survey_comments: comments,
            survey_submission_date: new Date()
        });

        res.redirect('/'); // Redirect to home or a "Thank You" page
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
