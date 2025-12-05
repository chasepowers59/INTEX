const express = require('express');
const router = express.Router();
const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
const { isAuthenticated } = require('../middleware/authMiddleware');
const { generateId } = require('../utils/idGenerator');

// Get Survey Form (for a specific registration)
router.get('/new/:registrationId', isAuthenticated, async (req, res) => {
    try {
        const registration = await knex('registrations')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .where('registrations.registration_id', req.params.registrationId)
            .select('event_definitions.event_name', 'registrations.registration_id', 'registrations.participant_id')
            .first();

        if (!registration) {
            return res.status(404).send('Registration not found');
        }

        // Authorization: Ensure participant can only submit surveys for their own registrations
        // Managers/admins can submit for any registration
        const isAuthorized = 
            (req.user.participant_role && ['admin', 'manager'].includes(req.user.participant_role.toLowerCase())) ||
            req.user.participant_id == registration.participant_id;

        if (!isAuthorized) {
            return res.status(403).send('Unauthorized: You can only submit surveys for your own registrations');
        }

        res.render('surveys/form', { user: req.user, registration });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Post Survey
router.post('/new', isAuthenticated, async (req, res) => {
    try {
        const { registration_id, satisfaction, usefulness, instructor, recommendation, comments } = req.body;
        
        // Verify registration exists and user has permission
        const registration = await knex('registrations')
            .where('registration_id', registration_id)
            .first();

        if (!registration) {
            return res.status(404).send('Registration not found');
        }

        // Authorization: Ensure participant can only submit surveys for their own registrations
        const isAuthorized = 
            (req.user.participant_role && ['admin', 'manager'].includes(req.user.participant_role.toLowerCase())) ||
            req.user.participant_id == registration.participant_id;

        if (!isAuthorized) {
            return res.status(403).send('Unauthorized: You can only submit surveys for your own registrations');
        }

        // Check if survey already exists
        const existingSurvey = await knex('surveys')
            .where('registration_id', registration_id)
            .first();

        if (existingSurvey) {
            req.flash('error', 'A survey has already been submitted for this event.');
            return res.redirect(`/participants/${req.user.participant_id}`);
        }

        const surveyId = generateId();

        // Calculate overall score (simple average)
        const overall = (parseFloat(satisfaction) + parseFloat(usefulness) + parseFloat(instructor) + parseFloat(recommendation)) / 4;

        // Calculate NPS Bucket based on recommendation score (0-5 scale)
        // Business Logic: NPS segmentation for survey analysis
        // Promoters: Scores 4-5 (highly likely to recommend)
        // Passives: Score 3 (neutral)
        // Detractors: Scores 0-2 (unlikely to recommend)
        let npsBucket = null;
        const recScore = parseFloat(recommendation);
        if (!isNaN(recScore)) {
            if (recScore >= 4) {
                npsBucket = 'Promoter';
            } else if (recScore === 3) {
                npsBucket = 'Passive';
            } else if (recScore >= 0 && recScore <= 2) {
                npsBucket = 'Detractor';
            }
        }

        await knex('surveys').insert({
            survey_id: surveyId,
            registration_id,
            survey_satisfaction_score: satisfaction,
            survey_usefulness_score: usefulness,
            survey_instructor_score: instructor,
            survey_recommendation_score: recommendation,
            survey_overall_score: overall,
            survey_nps_bucket: npsBucket,
            survey_comments: comments,
            survey_submission_date: new Date()
        });

        req.flash('success', 'Survey submitted successfully! Thank you for your feedback.');
        res.redirect(`/participants/${req.user.participant_id}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error submitting survey. Please try again.');
        res.redirect(`/participants/${req.user.participant_id}`);
    }
});

module.exports = router;
