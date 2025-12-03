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
            // Use exact match for role filter (role values are standardized)
            query = query.where('participant_role', role);
        }

        if (city) {
            // Use case-insensitive pattern matching for city (allows partial matches)
            query = query.where('participant_city', 'ilike', `%${city}%`);
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
            participant_field_of_interest: req.body.participant_field_of_interest
        };

        await db('participants').insert(participantData);
        res.redirect('/participants');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Participant Self-Edit Profile (GET) - MUST be before /:id route to avoid route conflict
router.get('/edit-self', isAuthenticated, async (req, res) => {
    try {
        const participant = await db('participants').where({ participant_id: req.user.participant_id }).first();
        if (!participant) {
            return res.status(404).send('Participant not found');
        }
        res.render('participants/edit_self', { user: req.user, participant });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Change Password (GET) - MUST be before /:id route to avoid route conflict
router.get('/change-password', isAuthenticated, (req, res) => {
    res.render('participants/change_password', { user: req.user });
});

// Participant Detail Dashboard ("One Kid Hub")
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        // Prevent /:id from matching special routes (should be handled by routes above)
        if (req.params.id === 'edit-self' || req.params.id === 'change-password' || req.params.id === 'add') {
            return res.status(404).send('Route not found');
        }

        // Access Control
        const user = req.user;
        const isAuthorized =
            (user.participant_role && ['admin', 'manager'].includes(user.participant_role.toLowerCase())) ||
            (user.participant_id && String(user.participant_id) === String(req.params.id));

        if (!isAuthorized) {
            return res.status(403).render('error', {
                user: req.user,
                message: 'You are not authorized to view this profile.',
                error: { status: 403 }
            });
        }

        const participant = await db('participants').where({ participant_id: req.params.id }).first();
        console.log('Fetching participant:', req.params.id); // DEBUG
        console.log('Data found:', participant); // DEBUG

        if (!participant) return res.status(404).send('Participant not found');

        // Fetch related data
        console.log('Fetching milestones...');
        const milestones = await db('milestones')
            .where({ participant_id: req.params.id })
            .select('*') || [];
        console.log('Milestones found:', milestones.length);

        console.log('Fetching events...');
        const allEvents = await db('registrations')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .where({ 'registrations.participant_id': req.params.id })
            .select(
                'event_definitions.event_name', 
                'event_instances.event_date_time_start as start_time', 
                'event_instances.event_date_time_end as end_time',
                'event_instances.event_location as location', 
                'event_definitions.event_type', 
                'registrations.registration_id', 
                'registrations.registration_status',
                'registrations.registration_attended_flag'
            ) || [];
        console.log('Events found:', allEvents.length);

        // Separate upcoming and past events
        // Only show events that are in the future (start_time > now)
        const now = new Date();
        const nowTime = now.getTime();
        console.log('Current time for filtering:', now, 'Timestamp:', nowTime);
        
        const upcomingEvents = [];
        const pastEvents = [];
        
        allEvents.forEach(e => {
            if (!e.start_time) {
                pastEvents.push(e);
                return;
            }
            try {
                // Parse the date - handle both Date objects and strings
                let eventDate;
                if (e.start_time instanceof Date) {
                    eventDate = new Date(e.start_time.getTime());
                } else {
                    eventDate = new Date(e.start_time);
                }
                const eventTime = eventDate.getTime();
                
                if (isNaN(eventTime)) {
                    console.log('Invalid event date:', e.start_time, 'for event:', e.event_name);
                    pastEvents.push(e);
                    return;
                }
                
                // Only include events that are in the future (strictly greater than now)
                const isFuture = eventTime > nowTime;
                const timeDiff = eventTime - nowTime;
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                
                if (isFuture) {
                    upcomingEvents.push(e);
                    console.log('✓ UPCOMING:', e.event_name, '| Date:', eventDate.toISOString(), '| EventTime:', eventTime, '| NowTime:', nowTime, '| Diff (hours):', hoursDiff.toFixed(2));
                } else {
                    pastEvents.push(e);
                    console.log('✗ PAST:', e.event_name, '| Date:', eventDate.toISOString(), '| EventTime:', eventTime, '| NowTime:', nowTime, '| Diff (hours):', hoursDiff.toFixed(2));
                }
            } catch (err) {
                console.error('Error parsing event date:', err, e.start_time);
                pastEvents.push(e);
            }
        });
        
        console.log('Total events:', allEvents.length);
        console.log('Upcoming events:', upcomingEvents.length);
        console.log('Past events:', pastEvents.length);

        // Check which registrations have surveys
        const registrationIds = allEvents.map(e => e.registration_id);
        const existingSurveys = registrationIds.length > 0 
            ? await db('surveys').whereIn('registration_id', registrationIds).select('registration_id') || []
            : [];
        const surveyRegistrationIds = new Set(existingSurveys.map(s => s.registration_id));

        console.log('Fetching surveys...');
        const surveys = await db('surveys')
            .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .where('registrations.participant_id', req.params.id)
            .select('surveys.*', 'event_definitions.event_name') || [];
        console.log('Surveys found:', surveys.length);

        console.log('Fetching donations...');
        const donations = await db('donations')
            .where({ participant_id: req.params.id }) || [];
        console.log('Donations found:', donations.length);

        // Calculate Averages
        let avgSat = 0, avgUse = 0, avgRec = 0;
        if (surveys.length > 0) {
            avgSat = surveys.reduce((acc, s) => acc + parseFloat(s.survey_satisfaction_score || 0), 0) / surveys.length;
            avgUse = surveys.reduce((acc, s) => acc + parseFloat(s.survey_usefulness_score || 0), 0) / surveys.length;
            avgRec = surveys.reduce((acc, s) => acc + parseFloat(s.survey_recommendation_score || 0), 0) / surveys.length;
        }

        console.log('Attempting to render view...');
        try {
            res.render('participants/detail', {
                user: req.user,
                participant,
                milestones,
                registrations: pastEvents, // Past events for Event History
                upcomingEvents: upcomingEvents, // Upcoming events
                surveys,
                donations,
                surveyRegistrationIds: Array.from(surveyRegistrationIds), // For checking if survey exists
                averages: {
                    satisfaction: avgSat.toFixed(1),
                    usefulness: avgUse.toFixed(1),
                    recommendation: avgRec.toFixed(1)
                }
            });
        } catch (renderErr) {
            console.error('EJS RENDER ERROR:', renderErr);
            res.status(500).send('Error rendering view: ' + renderErr.message);
        }
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
            participant_field_of_interest: req.body.participant_field_of_interest
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

// Participant Self-Edit Profile (POST)
router.post('/edit-self', isAuthenticated, async (req, res) => {
    try {
        // Ensure user can only edit their own profile
        if (req.user.participant_id != req.body.participant_id) {
            return res.status(403).send('Unauthorized: You can only edit your own profile');
        }

        const participantData = {
            participant_email: req.body.participant_email,
            participant_first_name: req.body.participant_first_name,
            participant_last_name: req.body.participant_last_name,
            participant_dob: req.body.participant_dob || null,
            participant_phone: req.body.participant_phone || null,
            participant_city: req.body.participant_city || null,
            participant_state: req.body.participant_state || null,
            participant_zip: req.body.participant_zip || null,
            participant_school_or_employer: req.body.participant_school_or_employer || null,
            participant_field_of_interest: req.body.participant_field_of_interest || null
            // Note: participant_role is NOT included - only managers can change roles
        };

        await db('participants').where({ participant_id: req.user.participant_id }).update(participantData);
        req.flash('success', 'Profile updated successfully!');
        res.redirect(`/participants/${req.user.participant_id}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating profile. Please try again.');
        res.redirect('/participants/edit-self');
    }
});

// Change Password (POST)
router.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        if (new_password !== confirm_password) {
            req.flash('error', 'New passwords do not match');
            return res.redirect('/participants/change-password');
        }

        // Get current participant
        const participant = await db('participants').where({ participant_id: req.user.participant_id }).first();
        if (!participant) {
            return res.status(404).send('Participant not found');
        }

        // Verify current password (plain text comparison)
        if (participant.participant_password !== current_password) {
            req.flash('error', 'Current password is incorrect');
            return res.redirect('/participants/change-password');
        }

        // Update password (plain text storage)
        await db('participants')
            .where({ participant_id: req.user.participant_id })
            .update({ participant_password: new_password });

        req.flash('success', 'Password changed successfully!');
        res.redirect(`/participants/${req.user.participant_id}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error changing password. Please try again.');
        res.redirect('/participants/change-password');
    }
});

module.exports = router;
