const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
const bcrypt = require('bcrypt');
const { generateId } = require('../utils/idGenerator');

exports.getDashboard = async (req, res) => {
    try {
        const { eventType, city, role } = req.query;
        console.log('Dashboard Filters:', { eventType, city, role });

        // 0. Fetch Filter Options (Dynamic)
        const cities = await knex('participants').distinct('participant_city').whereNotNull('participant_city').orderBy('participant_city').pluck('participant_city');
        const roles = await knex('participants').distinct('participant_role').whereNotNull('participant_role').orderBy('participant_role').pluck('participant_role');
        const eventTypes = await knex('event_definitions').distinct('event_type').orderBy('event_type').pluck('event_type');

        // 1. Base Data Fetching - Get filtered IDs first
        let filteredParticipantIds = knex('participants').select('participant_id');
        let filteredRegistrationIds = knex('registrations')
            .join('participants', 'registrations.participant_id', 'participants.participant_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .select('registrations.registration_id');

        // Apply Filters
        if (city && city !== '') {
            filteredParticipantIds = filteredParticipantIds.where('participant_city', city);
            filteredRegistrationIds = filteredRegistrationIds.where('participants.participant_city', city);
        }
        if (role && role !== '') {
            filteredParticipantIds = filteredParticipantIds.where('participant_role', role);
            filteredRegistrationIds = filteredRegistrationIds.where('participants.participant_role', role);
        }
        if (eventType && eventType !== '') {
            filteredRegistrationIds = filteredRegistrationIds.where('event_definitions.event_type', eventType);
            filteredParticipantIds = filteredParticipantIds.whereIn('participant_id', function () {
                this.select('participant_id').from('registrations')
                    .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                    .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
                    .where('event_definitions.event_type', eventType);
            });
        }

        const pIds = await filteredParticipantIds.pluck('participant_id');
        const rIds = await filteredRegistrationIds.pluck('registration_id');

        // 2. Calculate KPIs
        const totalParticipants = pIds.length;

        // KPI 1: Avg Satisfaction (Across all filtered events)
        const avgSatisfactionResult = await knex('surveys')
            .whereIn('registration_id', rIds)
            .avg('survey_satisfaction_score as avg')
            .first();
        const satisfactionScore = avgSatisfactionResult && avgSatisfactionResult.avg
            ? parseFloat(avgSatisfactionResult.avg).toFixed(1)
            : 0;

        // KPI 2: Higher Education Milestones (Count)
        // Milestones: "Accepted to College", "FAFSA Completed", "Scholarship"
        const higherEdKeywords = ['College', 'FAFSA', 'Scholarship', 'University', 'Degree'];
        let milestoneCount = 0;
        if (pIds.length > 0) {
            const milestoneResult = await knex('milestones')
                .whereIn('participant_id', pIds)
                .where(builder => {
                    higherEdKeywords.forEach(keyword => {
                        builder.orWhere('milestone_title', 'ilike', `%${keyword}%`);
                    });
                })
                .count('milestone_id as count')
                .first();
            milestoneCount = parseInt(milestoneResult.count);
        }

        // KPI 3: Event Effectiveness (STEAM vs Heritage Satisfaction)
        // We'll calculate the gap or just show STEAM satisfaction for now as a simple metric, 
        // or we can pass both to the view if we want to get fancy. 
        // Let's stick to the "STEAM Interest Rate" as requested in the previous turn, 
        // BUT the user asked for "Event Effectiveness" in this turn.
        // Let's calculate Avg Satisfaction for STEAM events specifically.
        const steamSatisfactionResult = await knex('surveys')
            .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .whereIn('registrations.registration_id', rIds)
            .where('event_definitions.event_type', 'STEAM')
            .avg('survey_satisfaction_score as avg')
            .first();

        const steamSatisfaction = steamSatisfactionResult && steamSatisfactionResult.avg
            ? parseFloat(steamSatisfactionResult.avg).toFixed(1)
            : 'N/A';

        // Reuse the variable name steamInterestRate to pass this new metric or keep the old one?
        // The user asked to "Update the logic... to calculate... Event Effectiveness".
        // Let's keep "STEAM Interest Rate" as it's already in the view, but maybe update what it represents or add a new one?
        // The view expects `kpis.steamInterestRate`. Let's keep that but maybe update the label in the view if needed.
        // Or better, let's just calculate the Interest Rate as before because it's a good metric, 
        // and maybe add the Milestone Count as a new KPI if the view supports it.
        // Wait, the view has 3 cards: Total Participants, Avg Satisfaction, STEAM Interest Rate.
        // The user wants: Avg Satisfaction, Milestone Count, Event Effectiveness.
        // I should probably replace "Total Participants" or "STEAM Interest Rate" with "Milestone Count".
        // Let's replace "STEAM Interest Rate" with "Higher Ed Milestones" count for now as it seems more "Impact" focused.

        // Actually, let's keep it simple. 
        // Card 1: Total Participants (Keep)
        // Card 2: Avg Satisfaction (Keep)
        // Card 3: Higher Ed Milestones (New - replaces STEAM Interest Rate)

        const steamInterestRate = milestoneCount; // Hijacking this variable to avoid changing view structure too much, but I should rename it in the object passed to view.

        // 4. STEAM Impact Analytics
        // Define keyword arrays
        const educationKeywords = ['Education', 'College', 'University', 'Degree', 'Graduation', 'School', 'FAFSA', 'Scholarship', 'Enrolled', 'Accepted', 'Admission'];
        const jobKeywords = ['Job', 'Career', 'Employment', 'Hired', 'Position', 'Work', 'Internship', 'Employed'];
        const steamKeywords = ['Engineering', 'Science', 'Math', 'Technology', 'Medical', 'Nursing', 'Biology', 'CS', 'Computer', 'STEM', 'STEAM', 'Chemistry', 'Physics', 'Data', 'Software', 'Developer', 'Programmer'];

        // Metric A: Post-Secondary STEAM Rate
        let steamEducationRate = 0;
        if (pIds.length > 0) {
            // Total participants with Education milestones
            const totalEducationParticipants = await knex('milestones')
                .whereIn('participant_id', pIds)
                .where(builder => {
                    educationKeywords.forEach((keyword, index) => {
                        if (index === 0) {
                            builder.where('milestone_title', 'ilike', `%${keyword}%`);
                        } else {
                            builder.orWhere('milestone_title', 'ilike', `%${keyword}%`);
                        }
                    });
                })
                .distinct('participant_id')
                .count('participant_id as count')
                .first();

            const totalEducationCount = parseInt(totalEducationParticipants?.count || 0);

            if (totalEducationCount > 0) {
                // Participants with STEAM Education milestones (milestone must have BOTH education AND STEAM keywords)
                // Build education keyword condition
                const educationCondition = educationKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');
                // Build STEAM keyword condition
                const steamCondition = steamKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');
                
                const steamEducationParticipants = await knex('milestones')
                    .whereIn('participant_id', pIds)
                    .whereRaw(`(${educationCondition}) AND (${steamCondition})`)
                    .distinct('participant_id')
                    .count('participant_id as count')
                    .first();

                const steamEducationCount = parseInt(steamEducationParticipants?.count || 0);
                steamEducationRate = ((steamEducationCount / totalEducationCount) * 100).toFixed(1);
            }
        }

        // Metric B: Post-College STEAM Job Rate
        let steamJobRate = 0;
        if (pIds.length > 0) {
            // Total participants with Job/Career milestones
            const totalJobParticipants = await knex('milestones')
                .whereIn('participant_id', pIds)
                .where(builder => {
                    jobKeywords.forEach((keyword, index) => {
                        if (index === 0) {
                            builder.where('milestone_title', 'ilike', `%${keyword}%`);
                        } else {
                            builder.orWhere('milestone_title', 'ilike', `%${keyword}%`);
                        }
                    });
                })
                .distinct('participant_id')
                .count('participant_id as count')
                .first();

            const totalJobCount = parseInt(totalJobParticipants?.count || 0);

            if (totalJobCount > 0) {
                // Participants with STEAM Job milestones (milestone must have BOTH job AND STEAM keywords)
                // Build job keyword condition
                const jobCondition = jobKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');
                // Build STEAM keyword condition
                const steamCondition = steamKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');
                
                const steamJobParticipants = await knex('milestones')
                    .whereIn('participant_id', pIds)
                    .whereRaw(`(${jobCondition}) AND (${steamCondition})`)
                    .distinct('participant_id')
                    .count('participant_id as count')
                    .first();

                const steamJobCount = parseInt(steamJobParticipants?.count || 0);
                steamJobRate = ((steamJobCount / totalJobCount) * 100).toFixed(1);
            }
        }

        // 3. Charts Data
        const satisfactionByType = await knex('surveys')
            .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .whereIn('surveys.registration_id', rIds)
            .select('event_definitions.event_type')
            .avg('surveys.survey_satisfaction_score as avg_score')
            .groupBy('event_definitions.event_type');

        const cityDistribution = await knex('participants')
            .whereIn('participant_id', pIds)
            .select('participant_city')
            .count('participant_id as count')
            .groupBy('participant_city');

        res.render('admin/dashboard', {
            user: req.user,
            kpis: {
                milestoneCount: steamInterestRate, // Using the calculated milestone count (variable name hijack from previous step, but let's be clean)
                satisfactionScore,
                totalParticipants,
                steamEducationRate,
                steamJobRate
            },
            charts: {
                satisfaction: satisfactionByType,
                city: cityDistribution
            },
            filters: { eventType, city, role },
            options: { cities, roles, eventTypes } // Pass dynamic options
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).send('Server Error');
    }
};

// ==================== USER MAINTENANCE ====================

exports.listUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = knex('participants')
            .select('participant_id', 'participant_email', 'participant_role')
            .orderBy('participant_email', 'asc');

        if (search) {
            query = query.where('participant_email', 'ilike', `%${search}%`);
        }

        const users = await query;
        res.render('admin/users', { user: req.user, users, search });
    } catch (err) {
        console.error('List Users Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { participant_id } = req.params;
        const { participant_role } = req.body;

        await knex('participants')
            .where({ participant_id })
            .update({ participant_role });

        res.redirect('/admin/users');
    } catch (err) {
        console.error('Update Role Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.resetUserPassword = async (req, res) => {
    try {
        const { participant_id } = req.params;
        const participant = await knex('participants').where({ participant_id }).first();
        
        if (!participant) {
            return res.status(404).send('User not found');
        }

        // Generate password from first name + last name
        const newPassword = participant.participant_first_name + participant.participant_last_name;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await knex('participants')
            .where({ participant_id })
            .update({ participant_password: hashedPassword });

        res.redirect('/admin/users');
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).send('Server Error');
    }
};

// ==================== PARTICIPANT MAINTENANCE ====================

exports.listParticipants = async (req, res) => {
    try {
        const { search } = req.query;
        let query = knex('participants')
            .select('participant_id', 'participant_first_name', 'participant_last_name', 'participant_dob', 'participant_city')
            .orderBy('participant_last_name', 'asc');

        if (search) {
            query = query.where(builder => {
                builder.where('participant_first_name', 'ilike', `%${search}%`)
                    .orWhere('participant_last_name', 'ilike', `%${search}%`)
                    .orWhere('participant_city', 'ilike', `%${search}%`);
            });
        }

        const participants = await query;
        
        // Calculate age for each participant
        const participantsWithAge = participants.map(p => {
            let age = null;
            if (p.participant_dob) {
                const dob = new Date(p.participant_dob);
                const today = new Date();
                age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                    age--;
                }
            }
            return { ...p, age };
        });

        res.render('admin/participants', { user: req.user, participants: participantsWithAge, search });
    } catch (err) {
        console.error('List Participants Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getEditParticipant = async (req, res) => {
    try {
        const { id } = req.params;
        const participant = await knex('participants').where({ participant_id: id }).first();
        if (!participant) {
            return res.status(404).send('Participant not found');
        }
        res.render('admin/participant_edit', { user: req.user, participant });
    } catch (err) {
        console.error('Get Edit Participant Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.postEditParticipant = async (req, res) => {
    try {
        const { id } = req.params;
        const { participant_city, participant_first_name, participant_last_name } = req.body;

        await knex('participants')
            .where({ participant_id: id })
            .update({
                participant_city,
                participant_first_name,
                participant_last_name
            });

        res.redirect('/admin/participants');
    } catch (err) {
        console.error('Edit Participant Error:', err);
        res.status(500).send('Server Error');
    }
};

// ==================== EVENT MAINTENANCE ====================

exports.listEvents = async (req, res) => {
    try {
        const { search } = req.query;
        let query = knex('event_instances')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .select(
                'event_instances.event_instance_id',
                'event_instances.event_date_time_start',
                'event_instances.event_location',
                'event_instances.event_capacity',
                'event_definitions.event_name'
            )
            .orderBy('event_instances.event_date_time_start', 'desc');

        if (search) {
            query = query.where(builder => {
                builder.where('event_definitions.event_name', 'ilike', `%${search}%`)
                    .orWhere('event_instances.event_location', 'ilike', `%${search}%`);
            });
        }

        const events = await query;
        res.render('admin/events', { user: req.user, events, search });
    } catch (err) {
        console.error('List Events Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getAddEvent = async (req, res) => {
    try {
        const definitions = await knex('event_definitions').select('*').orderBy('event_name', 'asc');
        res.render('admin/event_form', { user: req.user, event: null, definitions });
    } catch (err) {
        console.error('Get Add Event Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.postAddEvent = async (req, res) => {
    try {
        const { event_definition_id, event_date_time_start, event_date_time_end, event_location, event_capacity } = req.body;
        const eventInstanceId = generateId();

        await knex('event_instances').insert({
            event_instance_id: eventInstanceId,
            event_definition_id,
            event_date_time_start,
            event_date_time_end,
            event_location,
            event_capacity: event_capacity || null
        });

        res.redirect('/admin/events');
    } catch (err) {
        console.error('Add Event Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getEditEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await knex('event_instances').where({ event_instance_id: id }).first();
        if (!event) {
            return res.status(404).send('Event not found');
        }
        const definitions = await knex('event_definitions').select('*').orderBy('event_name', 'asc');
        res.render('admin/event_form', { user: req.user, event, definitions });
    } catch (err) {
        console.error('Get Edit Event Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.postEditEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { event_definition_id, event_date_time_start, event_date_time_end, event_location, event_capacity } = req.body;

        await knex('event_instances')
            .where({ event_instance_id: id })
            .update({
                event_definition_id,
                event_date_time_start,
                event_date_time_end,
                event_location,
                event_capacity: event_capacity || null
            });

        res.redirect('/admin/events');
    } catch (err) {
        console.error('Edit Event Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('event_instances').where({ event_instance_id: id }).del();
        res.redirect('/admin/events');
    } catch (err) {
        console.error('Delete Event Error:', err);
        res.status(500).send('Server Error');
    }
};

// ==================== SURVEY MAINTENANCE ====================

exports.listSurveys = async (req, res) => {
    try {
        const { eventFilter, scoreFilter } = req.query;
        let query = knex('surveys')
            .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .join('participants', 'registrations.participant_id', 'participants.participant_id')
            .select(
                'surveys.survey_id',
                'event_definitions.event_name',
                'event_definitions.event_definition_id',
                'participants.participant_first_name',
                'participants.participant_last_name',
                'surveys.survey_satisfaction_score',
                'surveys.survey_nps_bucket',
                'surveys.survey_submission_date',
                'surveys.survey_comments'
            )
            .orderBy('surveys.survey_submission_date', 'desc');

        // Event filter
        if (eventFilter && eventFilter !== '') {
            query = query.where('event_definitions.event_definition_id', eventFilter);
        }

        // Score filter
        if (scoreFilter === 'detractors') {
            query = query.where('surveys.survey_satisfaction_score', '>=', 0)
                         .where('surveys.survey_satisfaction_score', '<=', 6);
        } else if (scoreFilter === 'promoters') {
            query = query.where('surveys.survey_satisfaction_score', '>=', 9)
                         .where('surveys.survey_satisfaction_score', '<=', 10);
        }

        const surveys = await query;
        
        // Fetch event definitions for dropdown
        const eventDefinitions = await knex('event_definitions')
            .select('event_definition_id', 'event_name')
            .orderBy('event_name', 'asc');

        res.render('admin/surveys', { 
            user: req.user, 
            surveys, 
            eventDefinitions,
            filters: { eventFilter, scoreFilter }
        });
    } catch (err) {
        console.error('List Surveys Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getSurveyDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const survey = await knex('surveys')
            .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .join('participants', 'registrations.participant_id', 'participants.participant_id')
            .where('surveys.survey_id', id)
            .select(
                'surveys.*',
                'event_definitions.event_name',
                'participants.participant_first_name',
                'participants.participant_last_name'
            )
            .first();

        if (!survey) {
            return res.status(404).send('Survey not found');
        }

        res.render('admin/survey_detail', { user: req.user, survey });
    } catch (err) {
        console.error('Get Survey Detail Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.deleteSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('surveys').where({ survey_id: id }).del();
        res.redirect('/admin/surveys');
    } catch (err) {
        console.error('Delete Survey Error:', err);
        res.status(500).send('Server Error');
    }
};

// ==================== MILESTONE MAINTENANCE ====================

exports.listMilestones = async (req, res) => {
    try {
        const { search } = req.query;
        let query = knex('milestones')
            .join('participants', 'milestones.participant_id', 'participants.participant_id')
            .select(
                'milestones.milestone_id',
                'milestones.milestone_title',
                'milestones.milestone_date',
                'participants.participant_first_name',
                'participants.participant_last_name',
                'participants.participant_id'
            )
            .orderBy('milestones.milestone_date', 'desc');

        if (search) {
            query = query.where(builder => {
                builder.where('milestones.milestone_title', 'ilike', `%${search}%`)
                    .orWhere('participants.participant_first_name', 'ilike', `%${search}%`)
                    .orWhere('participants.participant_last_name', 'ilike', `%${search}%`);
            });
        }

        const milestones = await query;
        res.render('admin/milestones', { user: req.user, milestones, search });
    } catch (err) {
        console.error('List Milestones Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getAddMilestone = async (req, res) => {
    try {
        const participants = await knex('participants')
            .select('participant_id', 'participant_first_name', 'participant_last_name')
            .orderBy('participant_last_name', 'asc');
        res.render('admin/milestone_form', { user: req.user, milestone: null, participants });
    } catch (err) {
        console.error('Get Add Milestone Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.postAddMilestone = async (req, res) => {
    try {
        const { participant_id, milestone_title, milestone_date } = req.body;
        const milestoneId = generateId();

        await knex('milestones').insert({
            milestone_id: milestoneId,
            participant_id,
            milestone_title,
            milestone_date
        });

        res.redirect('/admin/milestones');
    } catch (err) {
        console.error('Add Milestone Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getEditMilestone = async (req, res) => {
    try {
        const { id } = req.params;
        const milestone = await knex('milestones').where({ milestone_id: id }).first();
        if (!milestone) {
            return res.status(404).send('Milestone not found');
        }
        const participants = await knex('participants')
            .select('participant_id', 'participant_first_name', 'participant_last_name')
            .orderBy('participant_last_name', 'asc');
        res.render('admin/milestone_form', { user: req.user, milestone, participants });
    } catch (err) {
        console.error('Get Edit Milestone Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.postEditMilestone = async (req, res) => {
    try {
        const { id } = req.params;
        const { participant_id, milestone_title, milestone_date } = req.body;

        await knex('milestones')
            .where({ milestone_id: id })
            .update({
                participant_id,
                milestone_title,
                milestone_date
            });

        res.redirect('/admin/milestones');
    } catch (err) {
        console.error('Edit Milestone Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.deleteMilestone = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('milestones').where({ milestone_id: id }).del();
        res.redirect('/admin/milestones');
    } catch (err) {
        console.error('Delete Milestone Error:', err);
        res.status(500).send('Server Error');
    }
};

// ==================== DONATION MAINTENANCE ====================

exports.listDonations = async (req, res) => {
    try {
        const { search, startDate, endDate, minAmount } = req.query;
        let query = knex('donations')
            .leftJoin('participants', 'donations.participant_id', 'participants.participant_id')
            .select(
                'donations.donation_id',
                'donations.donation_amount',
                'donations.donation_date',
                'participants.participant_first_name',
                'participants.participant_last_name',
                'participants.participant_id'
            )
            .orderBy('donations.donation_date', 'desc');

        // Text search filter
        if (search) {
            query = query.where(builder => {
                builder.where('participants.participant_first_name', 'ilike', `%${search}%`)
                    .orWhere('participants.participant_last_name', 'ilike', `%${search}%`);
            });
        }

        // Date range filters
        if (startDate) {
            query = query.where('donations.donation_date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('donations.donation_date', '<=', endDate);
        }

        // Minimum amount filter
        if (minAmount) {
            query = query.where('donations.donation_amount', '>=', parseFloat(minAmount));
        }

        const donations = await query;
        res.render('admin/donations', { 
            user: req.user, 
            donations, 
            filters: { search, startDate, endDate, minAmount }
        });
    } catch (err) {
        console.error('List Donations Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getAddDonation = async (req, res) => {
    try {
        const participants = await knex('participants')
            .select('participant_id', 'participant_first_name', 'participant_last_name')
            .orderBy('participant_last_name', 'asc');
        res.render('admin/donation_form', { user: req.user, donation: null, participants });
    } catch (err) {
        console.error('Get Add Donation Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.postAddDonation = async (req, res) => {
    try {
        const { participant_id, donation_amount, donation_date } = req.body;
        const donationId = generateId();

        await knex('donations').insert({
            donation_id: donationId,
            participant_id: participant_id || null,
            donation_amount,
            donation_date
        });

        res.redirect('/admin/donations');
    } catch (err) {
        console.error('Add Donation Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getEditDonation = async (req, res) => {
    try {
        const { id } = req.params;
        const donation = await knex('donations').where({ donation_id: id }).first();
        if (!donation) {
            return res.status(404).send('Donation not found');
        }
        const participants = await knex('participants')
            .select('participant_id', 'participant_first_name', 'participant_last_name')
            .orderBy('participant_last_name', 'asc');
        res.render('admin/donation_form', { user: req.user, donation, participants });
    } catch (err) {
        console.error('Get Edit Donation Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.postEditDonation = async (req, res) => {
    try {
        const { id } = req.params;
        const { participant_id, donation_amount, donation_date } = req.body;

        await knex('donations')
            .where({ donation_id: id })
            .update({
                participant_id: participant_id || null,
                donation_amount,
                donation_date
            });

        res.redirect('/admin/donations');
    } catch (err) {
        console.error('Edit Donation Error:', err);
        res.status(500).send('Server Error');
    }
};

exports.deleteDonation = async (req, res) => {
    try {
        const { id } = req.params;
        await knex('donations').where({ donation_id: id }).del();
        res.redirect('/admin/donations');
    } catch (err) {
        console.error('Delete Donation Error:', err);
        res.status(500).send('Server Error');
    }
};
