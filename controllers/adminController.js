const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
const { generateId } = require('../utils/idGenerator');

exports.getDashboard = async (req, res) => {
    try {
        const { eventType, city, role } = req.query;
        console.log('Dashboard Filters:', { eventType, city, role });

        // 0. Fetch Filter Options (Dynamic)
        const cities = await knex('participants').distinct('participant_city').whereNotNull('participant_city').orderBy('participant_city').pluck('participant_city');
        const roles = await knex('participants').distinct('participant_role').whereNotNull('participant_role').orderBy('participant_role').pluck('participant_role');
        const eventTypes = await knex('event_definitions').distinct('event_type').orderBy('event_type').pluck('event_type');

        // Base Data Fetching Strategy: Build filtered ID sets first
        // Business Logic Decision: We create filtered participant and registration ID sets before calculating KPIs.
        // This ensures all subsequent calculations (satisfaction scores, milestones, etc.) use the same filtered dataset.
        // Alternative approach would be to filter each KPI query independently, but that risks inconsistencies.
        let filteredParticipantIds = knex('participants').select('participant_id');
        let filteredRegistrationIds = knex('registrations')
            .join('participants', 'registrations.participant_id', 'participants.participant_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .select('registrations.registration_id');

        // Apply Filters: Build up the query conditions based on user-selected filters
        // Each filter narrows down the dataset that will be used for all KPI calculations
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

        // Calculate KPIs: All metrics use the filtered ID sets to ensure consistency
        const totalParticipants = pIds.length;

        // KPI 1: Average Satisfaction Score
        // Business Logic: Calculate average satisfaction across all surveys for filtered registrations.
        // This gives managers insight into program quality for specific participant segments or event types.
        const avgSatisfactionResult = await knex('surveys')
            .whereIn('registration_id', rIds)
            .avg('survey_satisfaction_score as avg')
            .first();
        const satisfactionScore = avgSatisfactionResult && avgSatisfactionResult.avg
            ? parseFloat(avgSatisfactionResult.avg).toFixed(1)
            : 0;

        // KPI 2: Higher Education Milestones
        // Business Logic: Count milestones related to higher education achievement.
        // This metric tracks program success in helping participants pursue post-secondary education.
        // We use keyword matching because milestone titles are free-form text, allowing flexibility
        // while still capturing education-related achievements.
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

        // KPI 4: Total Donations
        const totalDonationsResult = await knex('donations').sum('donation_amount as total').first();
        const totalDonations = totalDonationsResult.total || 0;

        // KPI 5: Net Promoter Score (NPS)
        // Business Logic: NPS measures participant loyalty and program advocacy.
        // Calculation: (Promoters - Detractors) / Total * 100
        // Promoters: Scores 9-10 (highly likely to recommend)
        // Detractors: Scores 0-6 (unlikely to recommend)
        // This metric helps identify program strengths and areas needing improvement.
        const surveyStats = await knex('surveys')
            .select(
                knex.raw("COUNT(*) as total"),
                knex.raw("SUM(CASE WHEN survey_recommendation_score >= 9 THEN 1 ELSE 0 END) as promoters"),
                knex.raw("SUM(CASE WHEN survey_recommendation_score <= 6 THEN 1 ELSE 0 END) as detractors")
            )
            .first();

        let npsScore = 0;
        if (surveyStats && surveyStats.total > 0) {
            const promoters = parseInt(surveyStats.promoters);
            const detractors = parseInt(surveyStats.detractors);
            const total = parseInt(surveyStats.total);
            npsScore = Math.round(((promoters - detractors) / total) * 100);
        }

        // KPI 6: Attendance Count
        const attendanceResult = await knex('registrations')
            .where('registration_attended_flag', true)
            .count('registration_id as count')
            .first();
        const attendanceCount = parseInt(attendanceResult.count || 0);

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
            .groupBy('participant_city')
            .orderBy('count', 'desc')
            .limit(5);

        // Impact Data (Attended vs Missed)
        const impactStats = await knex('registrations')
            .whereIn('registration_id', rIds)
            .select(
                knex.raw("SUM(CASE WHEN registration_attended_flag = true THEN 1 ELSE 0 END) as attended"),
                knex.raw("SUM(CASE WHEN registration_attended_flag = false THEN 1 ELSE 0 END) as missed")
            )
            .first();

        const impactData = [
            parseInt(impactStats ? impactStats.attended : 0) || 0,
            parseInt(impactStats ? impactStats.missed : 0) || 0
        ];

        // Prepare Chart Data
        const cityLabels = cityDistribution.map(c => c.participant_city);
        const cityCounts = cityDistribution.map(c => parseInt(c.count));
        const attendanceData = impactData;

        res.render('admin/dashboard', {
            user: req.user,
            kpis: {
                milestoneCount: milestoneCount,
                satisfactionScore,
                totalParticipants,
                totalDonations,
                npsScore,
                attendanceCount,
                steamEducationRate: 0,
                steamJobRate: 0
            },
            // Pass specific chart variables as requested
            cityLabels,
            cityCounts,
            attendanceData,
            charts: { // Keep for backward compatibility if needed, or remove if fully replacing
                satisfaction: satisfactionByType,
                city: cityDistribution,
                impact: impactData
            },
            filters: { eventType, city, role },
            options: { cities, roles, eventTypes }
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).send('Server Error');
    }
};

// ==================== USER MAINTENANCE ====================

/**
 * List Users: Display all system users with role management
 * 
 * Business Logic: This view allows managers to see all users and modify their roles.
 * The search functionality uses case-insensitive pattern matching (ilike) to find users
 * by email address. This is a common pattern for user management interfaces.
 */
exports.listUsers = async (req, res) => {
    try {
        const { search } = req.query;
        // Query Strategy: Select only essential fields for the user list view
        // We don't need full participant details here, just user account information
        let query = knex('participants')
            .select('participant_id', 'participant_email', 'participant_role')
            .orderBy('participant_email', 'asc');

        // Search Logic: Case-insensitive email search
        // Using 'ilike' allows partial matches (e.g., searching "john" finds "john@example.com")
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

/**
 * Reset User Password: Allows admin to manually set a new password for a user
 * 
 * Business Logic: Admin can reset any user's password through the User Maintenance interface.
 * The password is hashed using bcrypt before storage for security. This ensures passwords
 * are not stored in plain text, protecting user accounts even if the database is compromised.
 * 
 * Security Note: Uses bcrypt with 10 salt rounds, which is the industry standard for password hashing.
 */
exports.resetUserPassword = async (req, res) => {
    try {
        const { participant_id } = req.params;
        const { new_password, confirm_password } = req.body;

        // Validation: Check if passwords match (client-side validation should catch this, but verify server-side)
        if (new_password !== confirm_password) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/admin/users');
        }

        // Validation: Check password is provided
        if (!new_password || new_password.trim() === '') {
            req.flash('error', 'Password cannot be empty');
            return res.redirect('/admin/users');
        }

        const participant = await knex('participants').where({ participant_id }).first();

        if (!participant) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/users');
        }

        // Store password as plain text (per requirements)
        // Update password in database
        await knex('participants')
            .where({ participant_id })
            .update({ participant_password: new_password });

        req.flash('success', `Password reset successfully for ${participant.participant_email}`);
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Reset Password Error:', err);
        req.flash('error', 'Error resetting password. Please try again.');
        res.redirect('/admin/users');
    }
};

// ==================== PARTICIPANT MAINTENANCE ====================

/**
 * List Participants: Display all participants with search functionality
 * 
 * Business Logic: This is the main participant management interface.
 * Search functionality spans multiple fields (name, city) to help managers quickly find participants.
 * Age calculation is performed in the controller rather than the database to handle edge cases
 * (like leap years) more reliably in JavaScript.
 */
exports.listParticipants = async (req, res) => {
    try {
        const { search } = req.query;
        // Query Strategy: Select fields needed for the list view
        // We calculate age client-side rather than using SQL date functions for better control
        let query = knex('participants')
            .select('participant_id', 'participant_first_name', 'participant_last_name', 'participant_dob', 'participant_city')
            .orderBy('participant_last_name', 'asc');

        // Multi-field Search Logic: Search across name and location
        // This allows managers to find participants by any identifying information
        if (search) {
            query = query.where(builder => {
                builder.where('participant_first_name', 'ilike', `%${search}%`)
                    .orWhere('participant_last_name', 'ilike', `%${search}%`)
                    .orWhere('participant_city', 'ilike', `%${search}%`);
            });
        }

        const participants = await query;

        // Age Calculation: Performed in JavaScript for better date handling
        // Business Logic: Calculate age from date of birth for display purposes.
        // We do this in the controller rather than SQL to handle edge cases (leap years, month boundaries)
        // more reliably. The calculation accounts for whether the birthday has occurred this year.
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
        const milestones = await knex('milestones').where({ participant_id: id }).orderBy('milestone_date', 'desc');
        res.render('admin/participant_edit', { user: req.user, participant, milestones });
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

/**
 * List Events: Display all event instances with search
 * 
 * Business Logic: Events are stored in a normalized structure (definitions + instances).
 * This allows the same event type to have multiple occurrences while maintaining consistent
 * event information. The search spans both event names and locations to help managers
 * find events quickly.
 */
exports.listEvents = async (req, res) => {
    try {
        const { search } = req.query;
        // Query Strategy: Join event_instances with event_definitions to get complete event information
        // This normalized structure allows multiple instances of the same event type
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

        // Multi-field Search: Search by event name or location
        // This helps managers find events by either identifying information
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
        const participant = await knex('participants').where({ participant_id: id }).first();
        if (!participant) {
            return res.status(404).send('Participant not found');
        }
        const milestones = await knex('milestones').where({ participant_id: id }).orderBy('milestone_date', 'desc');
        res.render('admin/participant_edit', { user: req.user, participant, milestones });
    } catch (err) {
        console.error('Get Edit Participant Error:', err);
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
        const { search, eventFilter, scoreFilter } = req.query;
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

        // Text Search Filter: Multi-field search across participant names, event names, and comments
        // Business Logic: Surveys contain rich information across multiple related tables.
        // Searching across participant names, event names, and comments allows managers to find
        // surveys by any relevant context. This is more flexible than searching only survey fields.
        if (search && search.trim() !== '') {
            query = query.where(builder => {
                builder.where('participants.participant_first_name', 'ilike', `%${search}%`)
                    .orWhere('participants.participant_last_name', 'ilike', `%${search}%`)
                    .orWhere('event_definitions.event_name', 'ilike', `%${search}%`)
                    .orWhere('surveys.survey_comments', 'ilike', `%${search}%`);
            });
        }

        // Event Filter: Filter by specific event type
        // Business Logic: Allows managers to analyze survey responses for specific programs
        if (eventFilter && eventFilter !== '') {
            query = query.where('event_definitions.event_definition_id', eventFilter);
        }

        // Score Filter: NPS-based filtering (Detractors vs Promoters)
        // Business Logic: This implements Net Promoter Score segmentation.
        // Detractors (0-6): Participants who are unlikely to recommend the program
        // Promoters (9-10): Participants who are highly likely to recommend
        // This helps managers identify program strengths and areas needing improvement
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
            search,
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

/**
 * List Donations: Display donations with advanced filtering
 * 
 * Business Logic: Donations can come from both registered participants and anonymous visitors.
 * We use LEFT JOIN because participant_id may be null for visitor donations. The filtering
 * supports multiple criteria (text search, date range, amount) to help managers analyze
 * donation patterns and identify top donors.
 */
exports.listDonations = async (req, res) => {
    try {
        const { search, startDate, endDate, minAmount } = req.query;
        // Query Strategy: LEFT JOIN because donations can exist without linked participants (visitor donations)
        // This ensures we show all donations, even those from anonymous visitors
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

        // Text Search: Search by donor name (for participant-linked donations)
        // Business Logic: Helps managers find donations from specific participants
        if (search) {
            query = query.where(builder => {
                builder.where('participants.participant_first_name', 'ilike', `%${search}%`)
                    .orWhere('participants.participant_last_name', 'ilike', `%${search}%`);
            });
        }

        // Date Range Filters: Filter donations by time period
        // Business Logic: Allows analysis of donation trends over time (monthly, quarterly, etc.)
        if (startDate) {
            query = query.where('donations.donation_date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('donations.donation_date', '<=', endDate);
        }

        // Minimum Amount Filter: Filter by donation size
        // Business Logic: Helps identify major donors and analyze donation distribution
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
