const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);


exports.getDashboard = async (req, res) => {
    try {
        const { eventType, city, role } = req.query;
        console.log('Dashboard Filters:', { eventType, city, role });

        // 1. Base Data Fetching - Get filtered IDs first
        // This avoids complex join interactions by isolating the filtering logic
        let filteredParticipantIds = knex('participants').select('participant_id');
        let filteredRegistrationIds = knex('registrations')
            .join('participants', 'registrations.participant_id', 'participants.participant_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .select('registrations.registration_id');

        // Apply Filters to the ID lists
        if (city && city !== '') {
            filteredParticipantIds = filteredParticipantIds.where('participant_city', city);
            filteredRegistrationIds = filteredRegistrationIds.where('participants.participant_city', city);
        }
        if (role && role !== '') {
            filteredParticipantIds = filteredParticipantIds.where('participant_role', role);
            filteredRegistrationIds = filteredRegistrationIds.where('participants.participant_role', role);
        }
        if (eventType && eventType !== '') {
            // If filtering by event type, we only care about registrations for that event type
            filteredRegistrationIds = filteredRegistrationIds.where('event_definitions.event_type', eventType);

            // And participants who have at least one registration for that event type
            filteredParticipantIds = filteredParticipantIds.whereIn('participant_id', function () {
                this.select('participant_id').from('registrations')
                    .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                    .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
                    .where('event_definitions.event_type', eventType);
            });
        }

        // Execute ID fetches
        const pIds = await filteredParticipantIds.pluck('participant_id');
        const rIds = await filteredRegistrationIds.pluck('registration_id');

        console.log(`Found ${pIds.length} participants and ${rIds.length} registrations matching filters.`);

        // 2. Calculate KPIs using the filtered IDs

        // Total Participants
        const totalParticipants = pIds.length;

        // Avg Satisfaction (from filtered registrations)
        const avgSatisfactionResult = await knex('surveys')
            .whereIn('registration_id', rIds)
            .avg('survey_satisfaction_score as avg')
            .first();
        const satisfactionScore = avgSatisfactionResult && avgSatisfactionResult.avg
            ? parseFloat(avgSatisfactionResult.avg).toFixed(1)
            : 0;

        // STEAM Interest (Placeholder)
        const steamInterestRate = 0;
        const steamGradRate = 0;
        const steamJobRate = 0;

        // 3. Charts Data

        // Satisfaction by Event Type
        // We want to see the breakdown for the *filtered* set of registrations
        const satisfactionByType = await knex('surveys')
            .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .whereIn('surveys.registration_id', rIds)
            .select('event_definitions.event_type')
            .avg('surveys.survey_satisfaction_score as avg_score')
            .groupBy('event_definitions.event_type');

        // City Distribution
        // We want to see the breakdown for the *filtered* set of participants
        const cityDistribution = await knex('participants')
            .whereIn('participant_id', pIds)
            .select('participant_city')
            .count('participant_id as count')
            .groupBy('participant_city');

        res.render('admin/dashboard', {
            user: req.session.user,
            kpis: {
                steamInterestRate,
                steamGradRate,
                steamJobRate,
                satisfactionScore,
                totalParticipants
            },
            charts: {
                satisfaction: satisfactionByType,
                city: cityDistribution
            },
            filters: { eventType, city, role }
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).send('Server Error');
    }
};
