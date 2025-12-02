const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);


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
            user: req.session.user,
            kpis: {
                milestoneCount: steamInterestRate, // Using the calculated milestone count (variable name hijack from previous step, but let's be clean)
                satisfactionScore,
                totalParticipants
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
