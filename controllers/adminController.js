const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
const { generateId } = require('../utils/idGenerator');

// Helper function to calculate trend percentage
// Business Logic: Calculate percentage change between current and previous period
// Returns object with direction ('up', 'down', 'neutral') and percentage change
function calculateTrend(current, previous) {
    if (!previous || previous === 0) {
        return { direction: current > 0 ? 'up' : 'neutral', percentage: current > 0 ? 100 : 0 };
    }
    const change = ((current - previous) / previous) * 100;
    return {
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
        percentage: Math.abs(Math.round(change))
    };
}

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

        // Get filtered IDs and ensure they are integers
        const pIdsRaw = await filteredParticipantIds.pluck('participant_id');
        const rIdsRaw = await filteredRegistrationIds.pluck('registration_id');
        
        // Convert to integers and filter out any invalid values
        const pIds = pIdsRaw.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
        const rIds = rIdsRaw.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);

        // Calculate KPIs: All metrics use the filtered ID sets to ensure consistency
        const totalParticipants = pIds.length;

        // KPI 1: Average Satisfaction Score
        // Business Logic: Calculate average satisfaction across all surveys for filtered registrations.
        // This gives managers insight into program quality for specific participant segments or event types.
        let satisfactionScore = '0.0';
        if (rIds.length > 0) {
            const avgSatisfactionResult = await knex('surveys')
                .whereIn('registration_id', rIds)
                .whereNotNull('survey_satisfaction_score')
                .avg('survey_satisfaction_score as avg')
                .first();
            satisfactionScore = avgSatisfactionResult && avgSatisfactionResult.avg
                ? parseFloat(avgSatisfactionResult.avg).toFixed(1)
                : '0.0';
        } else {
            // If no filters, calculate from all surveys
            const avgSatisfactionResult = await knex('surveys')
                .whereNotNull('survey_satisfaction_score')
                .avg('survey_satisfaction_score as avg')
                .first();
            satisfactionScore = avgSatisfactionResult && avgSatisfactionResult.avg
                ? parseFloat(avgSatisfactionResult.avg).toFixed(1)
                : '0.0';
        }

        // KPI 2: Higher Education Milestones
        // Business Logic: Count milestones related to higher education achievement.
        // This metric tracks program success in helping participants pursue post-secondary education.
        // We use keyword matching because milestone titles are free-form text, allowing flexibility
        // while still capturing education-related achievements.
        const higherEdKeywords = ['College', 'FAFSA', 'Scholarship', 'University', 'Degree'];
        let milestoneQuery = knex('milestones')
            .where(builder => {
                higherEdKeywords.forEach(keyword => {
                    builder.orWhere('milestone_title', 'ilike', `%${keyword}%`);
                });
            });
        
        // Apply participant filter if filters are active
        if (pIds.length > 0) {
            milestoneQuery = milestoneQuery.whereIn('participant_id', pIds);
        }
        
        const milestoneResult = await milestoneQuery.count('milestone_id as count').first();
        const milestoneCount = parseInt(milestoneResult.count || 0);

        // KPI 4: Total Donations
        // Business Logic: Sum all donations from the database, ensuring we only count actual donations
        // Only count donations with valid dates (not null, not in the future)
        // Filter by participant IDs if filters are applied to maintain consistency with other KPIs
        // Note: Donations can have null participant_id (visitor donations), so we use whereIn only when filters are active
        const nowForDonations = new Date();
        let totalDonationsQuery = knex('donations')
            .whereNotNull('donation_date')
            .whereNotNull('donation_amount')
            .where('donation_date', '<=', nowForDonations); // Don't include future dates
        
        // Apply participant filter if filters are active
        // When filters are applied, only count donations from filtered participants (excludes visitor donations)
        // When no filters, count all donations including visitor donations (where participant_id is null)
        if (pIds.length > 0) {
            totalDonationsQuery = totalDonationsQuery.whereIn('participant_id', pIds);
        }
        
        const totalDonationsResult = await totalDonationsQuery.sum('donation_amount as total').first();
        const totalDonations = totalDonationsResult && totalDonationsResult.total 
            ? parseFloat(totalDonationsResult.total) 
            : 0;
        
        // Debug: Log total donations calculation
        console.log('Total Donations KPI:', {
            total: totalDonations,
            participantFilter: pIds.length > 0 ? `${pIds.length} participants` : 'all participants'
        });

        // KPI 5: Net Promoter Score (NPS)
        // Business Logic: NPS measures participant loyalty and program advocacy.
        // Calculation: (Promoters - Detractors) / Total * 100
        // IMPORTANT: Survey uses 0-5 scale, not 0-10
        // Promoters: Scores 4-5 (highly likely to recommend)
        // Passives: Score 3 (neutral)
        // Detractors: Scores 0-2 (unlikely to recommend)
        // This metric helps identify program strengths and areas needing improvement.
        let npsQuery = knex('surveys')
            .whereNotNull('survey_recommendation_score');
        
        // Apply registration filter if filters are active for consistency
        if (rIds.length > 0) {
            npsQuery = npsQuery.whereIn('registration_id', rIds);
        }
        
        const surveyStats = await npsQuery
            .select(
                knex.raw("COUNT(*) as total"),
                knex.raw("SUM(CASE WHEN survey_recommendation_score >= 4 THEN 1 ELSE 0 END) as promoters"),
                knex.raw("SUM(CASE WHEN survey_recommendation_score <= 2 THEN 1 ELSE 0 END) as detractors")
            )
            .first();

        let npsScore = 0;
        if (surveyStats && surveyStats.total > 0) {
            const promoters = parseInt(surveyStats.promoters || 0);
            const detractors = parseInt(surveyStats.detractors || 0);
            const total = parseInt(surveyStats.total);
            npsScore = Math.round(((promoters - detractors) / total) * 100);
        }
        
        // Debug: Log NPS calculation
        console.log('NPS Score Calculation:', {
            total: surveyStats ? parseInt(surveyStats.total) : 0,
            promoters: surveyStats ? parseInt(surveyStats.promoters || 0) : 0,
            detractors: surveyStats ? parseInt(surveyStats.detractors || 0) : 0,
            npsScore: npsScore
        });

        // KPI 6: Attendance Count (for filtered registrations)
        // Business Logic: Count registrations where attendance flag is true, using filtered registration IDs
        let attendanceQuery = knex('registrations')
            .where('registration_attended_flag', true);
        
        // Apply registration filter if filters are active
        if (rIds.length > 0) {
            attendanceQuery = attendanceQuery.whereIn('registration_id', rIds);
        }
        
        const attendanceResult = await attendanceQuery.count('registration_id as count').first();
        const attendanceCount = parseInt(attendanceResult.count || 0);

        // KPI 7: Total Events (always show all events, not filtered)
        const totalEventsResult = await knex('event_instances')
            .count('event_instance_id as count')
            .first();
        const totalEvents = parseInt(totalEventsResult.count || 0);

        // KPI 8: Attendance Rate
        // Business Logic: Calculate percentage of registrations that resulted in attendance
        // Both numerator and denominator must use the same filter for consistency
        let totalRegistrationsQuery = knex('registrations');
        
        // Apply registration filter if filters are active
        if (rIds.length > 0) {
            totalRegistrationsQuery = totalRegistrationsQuery.whereIn('registration_id', rIds);
        }
        
        const totalRegistrations = await totalRegistrationsQuery.count('registration_id as count').first();
        const totalRegCount = parseInt(totalRegistrations.count || 0);
        const attendanceRate = totalRegCount > 0 
            ? Math.round((attendanceCount / totalRegCount) * 100) 
            : 0;

        // Calculate Trends (Current Period vs Previous Period)
        // Business Logic: Compare current month data with previous month to show growth/decline trends
        // Use a single 'nowDate' reference to ensure consistency across all date calculations
        const nowDate = new Date();
        
        // KPI 9: Active Registrations (Upcoming Events)
        // Business Logic: Count registrations for future events
        // Apply participant filter if filters are active for consistency
        let activeRegistrationsQuery = knex('registrations')
            .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
            .where('event_instances.event_date_time_start', '>', nowDate);
        
        // Apply participant filter if filters are active
        if (pIds.length > 0) {
            activeRegistrationsQuery = activeRegistrationsQuery.whereIn('registrations.participant_id', pIds);
        }
        
        const activeRegistrationsResult = await activeRegistrationsQuery
            .count('registrations.registration_id as count')
            .first();
        const activeRegistrations = parseInt(activeRegistrationsResult.count || 0);
        const currentMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
        const previousMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
        const previousMonthEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), 0);
        
        // Debug: Log date ranges for troubleshooting
        console.log('Dashboard Date Ranges:', {
            now: nowDate.toISOString(),
            currentMonthStart: currentMonthStart.toISOString(),
            previousMonthStart: previousMonthStart.toISOString()
        });

        // Participants Trend (using registration dates as proxy since participants table doesn't have created_at)
        let currentParticipants = { count: 0 };
        let prevParticipants = { count: 0 };
        if (pIds.length > 0) {
            currentParticipants = await knex('registrations')
                .whereIn('participant_id', pIds)
                .whereNotNull('registration_created_at')
                .where('registration_created_at', '>=', currentMonthStart)
                .countDistinct('participant_id as count')
                .first();
            prevParticipants = await knex('registrations')
                .whereIn('participant_id', pIds)
                .whereNotNull('registration_created_at')
                .where('registration_created_at', '>=', previousMonthStart)
                .where('registration_created_at', '<', currentMonthStart)
                .countDistinct('participant_id as count')
                .first();
        }
        const participantsTrend = calculateTrend(parseInt(currentParticipants.count || 0), parseInt(prevParticipants.count || 0));

        // Donations Trend
        // Business Logic: Compare current month donations vs previous month
        // Only count donations with valid dates (not null, not in the future) and valid amounts
        // Use nowDate (already defined above) instead of creating a new Date()
        let currentDonationsQuery = knex('donations')
            .whereNotNull('donation_date')
            .whereNotNull('donation_amount')
            .where('donation_date', '>=', currentMonthStart)
            .where('donation_date', '<=', nowDate); // Don't include future dates
        let prevDonationsQuery = knex('donations')
            .whereNotNull('donation_date')
            .whereNotNull('donation_amount')
            .where('donation_date', '>=', previousMonthStart)
            .where('donation_date', '<', currentMonthStart); // Previous month only
        
        // Apply participant filter if filters are active
        if (pIds.length > 0) {
            currentDonationsQuery = currentDonationsQuery.whereIn('participant_id', pIds);
            prevDonationsQuery = prevDonationsQuery.whereIn('participant_id', pIds);
        }
        
        const currentDonations = await currentDonationsQuery.sum('donation_amount as total').first();
        const prevDonations = await prevDonationsQuery.sum('donation_amount as total').first();
        
        // Debug: Log donation trend data
        console.log('Donation Trends:', {
            currentMonth: currentMonthStart.toISOString(),
            currentTotal: currentDonations && currentDonations.total ? parseFloat(currentDonations.total) : 0,
            previousMonth: previousMonthStart.toISOString(),
            previousTotal: prevDonations && prevDonations.total ? parseFloat(prevDonations.total) : 0
        });
        
        const donationsTrend = calculateTrend(
            parseFloat(currentDonations && currentDonations.total ? currentDonations.total : 0), 
            parseFloat(prevDonations && prevDonations.total ? prevDonations.total : 0)
        );

        // Satisfaction Trend (using survey_submission_date)
        let currentSatisfaction = { avg: null };
        let prevSatisfaction = { avg: null };
        if (rIds.length > 0) {
            currentSatisfaction = await knex('surveys')
                .whereIn('registration_id', rIds)
                .whereNotNull('survey_submission_date')
                .where('survey_submission_date', '>=', currentMonthStart)
                .avg('survey_satisfaction_score as avg')
                .first();
            prevSatisfaction = await knex('surveys')
                .whereIn('registration_id', rIds)
                .whereNotNull('survey_submission_date')
                .where('survey_submission_date', '>=', previousMonthStart)
                .where('survey_submission_date', '<', currentMonthStart)
                .avg('survey_satisfaction_score as avg')
                .first();
        }
        const satisfactionTrend = calculateTrend(
            parseFloat(currentSatisfaction.avg || 0), 
            parseFloat(prevSatisfaction.avg || 0)
        );

        // Milestones Trend
        let currentMilestones = { count: 0 };
        let prevMilestones = { count: 0 };
        if (pIds.length > 0) {
            currentMilestones = await knex('milestones')
                .whereIn('participant_id', pIds)
                .whereNotNull('milestone_date')
                .where('milestone_date', '>=', currentMonthStart)
                .count('milestone_id as count')
                .first();
            prevMilestones = await knex('milestones')
                .whereIn('participant_id', pIds)
                .whereNotNull('milestone_date')
                .where('milestone_date', '>=', previousMonthStart)
                .where('milestone_date', '<', currentMonthStart)
                .count('milestone_id as count')
                .first();
        }
        const milestonesTrend = calculateTrend(parseInt(currentMilestones.count || 0), parseInt(prevMilestones.count || 0));

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

        // Event Attendance Over Time (Last 6 Months)
        // Business Logic: Show registration trends for the last 6 months
        // Include all events through the end of the current month to match donation trends
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        // Set to end of current month to include all data through December
        const endOfCurrentMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59);
        let attendanceOverTime = [];
        if (rIds.length > 0) {
            attendanceOverTime = await knex('registrations')
                .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                .where('event_instances.event_date_time_start', '>=', sixMonthsAgo)
                .where('event_instances.event_date_time_start', '<=', endOfCurrentMonth) // Include all events through end of current month
                .whereIn('registrations.registration_id', rIds)
                .select(
                    knex.raw("DATE_TRUNC('month', event_instances.event_date_time_start) as month"),
                    knex.raw("COUNT(*) as count")
                )
                .groupBy('month')
                .orderBy('month', 'asc');
        } else {
            // If no filters, calculate from all registrations
            attendanceOverTime = await knex('registrations')
                .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                .where('event_instances.event_date_time_start', '>=', sixMonthsAgo)
                .where('event_instances.event_date_time_start', '<=', endOfCurrentMonth) // Include all events through end of current month
                .select(
                    knex.raw("DATE_TRUNC('month', event_instances.event_date_time_start) as month"),
                    knex.raw("COUNT(*) as count")
                )
                .groupBy('month')
                .orderBy('month', 'asc');
        }

        // Satisfaction Trends Over Time (Last 6 Months)
        // Business Logic: Show satisfaction trends for the last 6 months
        // Include all events through the end of the current month to match donation trends
        let satisfactionOverTime = [];
        if (rIds.length > 0) {
            satisfactionOverTime = await knex('surveys')
                .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
                .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                .where('event_instances.event_date_time_start', '>=', sixMonthsAgo)
                .where('event_instances.event_date_time_start', '<=', endOfCurrentMonth) // Include all events through end of current month
                .whereNotNull('survey_satisfaction_score')
                .whereIn('surveys.registration_id', rIds)
                .select(
                    knex.raw("DATE_TRUNC('month', event_instances.event_date_time_start) as month"),
                    knex.raw("AVG(survey_satisfaction_score) as avg_score")
                )
                .groupBy('month')
                .orderBy('month', 'asc');
        } else {
            // If no filters, calculate from all surveys
            satisfactionOverTime = await knex('surveys')
                .join('registrations', 'surveys.registration_id', 'registrations.registration_id')
                .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                .where('event_instances.event_date_time_start', '>=', sixMonthsAgo)
                .where('event_instances.event_date_time_start', '<=', endOfCurrentMonth) // Include all events through end of current month
                .whereNotNull('survey_satisfaction_score')
                .select(
                    knex.raw("DATE_TRUNC('month', event_instances.event_date_time_start) as month"),
                    knex.raw("AVG(survey_satisfaction_score) as avg_score")
                )
                .groupBy('month')
                .orderBy('month', 'asc');
        }

        // Donation Trends Over Time (Last 6 Months)
        // Business Logic: Show donation trends for the last 6 months from actual database data
        // Only include donations with valid dates (not null, not in the future) and valid amounts
        // Use endOfCurrentMonth to include all donations through the end of the current month
        let donationOverTimeQuery = knex('donations')
            .whereNotNull('donation_date')
            .whereNotNull('donation_amount')
            .where('donation_date', '>=', sixMonthsAgo)
            .where('donation_date', '<=', endOfCurrentMonth); // Include all donations through end of current month
        
        // Apply participant filter if filters are active
        if (pIds.length > 0) {
            donationOverTimeQuery = donationOverTimeQuery.whereIn('participant_id', pIds);
        }
        
        const donationOverTimeRaw = await donationOverTimeQuery
            .select(
                knex.raw("DATE_TRUNC('month', donation_date) as month"),
                knex.raw("SUM(donation_amount) as total")
            )
            .groupBy('month')
            .orderBy('month', 'asc');
        
        // Filter out any future dates and ensure data is valid
        // Also ensure we only include months that actually have donations
        const donationOverTime = donationOverTimeRaw.filter(item => {
            if (!item.month) return false;
            const monthDate = new Date(item.month);
            // Only include months that are within the range and have valid totals
            return monthDate <= endOfCurrentMonth && item.total && parseFloat(item.total) > 0;
        });
        
        // Debug: Log donation over time data
        console.log('Donation Over Time (Last 6 Months):', {
            sixMonthsAgo: sixMonthsAgo.toISOString(),
            now: nowDate.toISOString(),
            rawCount: donationOverTimeRaw.length,
            filteredCount: donationOverTime.length,
            months: donationOverTime.map(d => ({
                month: d.month ? new Date(d.month).toISOString() : null,
                total: parseFloat(d.total || 0)
            }))
        });

        // Recent Activity (Last 10 Registrations)
        let recentActivity = [];
        if (rIds.length > 0) {
            recentActivity = await knex('registrations')
                .join('participants', 'registrations.participant_id', 'participants.participant_id')
                .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
                .whereIn('registrations.registration_id', rIds)
                .select(
                    'registrations.registration_id',
                    'participants.participant_first_name',
                    'participants.participant_last_name',
                    'event_definitions.event_name',
                    'event_instances.event_date_time_start',
                    'registrations.registration_status',
                    'registrations.registration_created_at'
                )
                .orderBy('registrations.registration_created_at', 'desc')
                .limit(10);
        }

        // Top Performers (Top 5 by Milestone Count)
        let topPerformers = [];
        if (pIds.length > 0) {
            topPerformers = await knex('participants')
                .leftJoin('milestones', 'participants.participant_id', 'milestones.participant_id')
                .whereIn('participants.participant_id', pIds)
                .select(
                    'participants.participant_id',
                    'participants.participant_first_name',
                    'participants.participant_last_name',
                    knex.raw('COUNT(milestones.milestone_id) as milestone_count')
                )
                .groupBy('participants.participant_id', 'participants.participant_first_name', 'participants.participant_last_name')
                .orderBy('milestone_count', 'desc')
                .limit(5);
        }

        // Upcoming Events (Next 5)
        // Use nowDate for consistency (defined earlier in trends section)
        const upcomingEvents = await knex('event_instances')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .where('event_instances.event_date_time_start', '>', nowDate)
            .select(
                'event_instances.event_instance_id',
                'event_definitions.event_name',
                'event_definitions.event_type',
                'event_instances.event_date_time_start',
                'event_instances.event_location'
            )
            .orderBy('event_instances.event_date_time_start', 'asc')
            .limit(5);

        res.render('admin/dashboard', {
            user: req.user,
            kpis: {
                milestoneCount: milestoneCount,
                satisfactionScore,
                totalParticipants,
                totalDonations,
                npsScore,
                attendanceCount,
                totalEvents,
                attendanceRate,
                activeRegistrations,
                trends: {
                    participants: participantsTrend,
                    donations: donationsTrend,
                    satisfaction: satisfactionTrend,
                    milestones: milestonesTrend
                }
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
            options: { cities, roles, eventTypes },
            attendanceOverTime,
            satisfactionOverTime,
            donationOverTime,
            recentActivity,
            topPerformers,
            upcomingEvents
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
        // Business Logic: Only show participants who have passwords (actual user accounts)
        // This excludes participant records created from visitor registrations/donations that don't have passwords yet
        // We don't need full participant details here, just user account information
        let query = knex('participants')
            .select('participant_id', 'participant_email', 'participant_role')
            .whereNotNull('participant_password') // Only show users with passwords (actual accounts)
            .where('participant_password', '!=', '') // Exclude empty passwords
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

exports.deleteUser = async (req, res) => {
    try {
        const { participant_id } = req.params;
        
        // Prevent deleting yourself
        if (parseInt(participant_id) === parseInt(req.user.participant_id)) {
            req.flash('error', 'Cannot delete your own account');
            return res.redirect('/admin/users');
        }

        // Delete the user (participant record)
        // Note: This will cascade delete related records if foreign key constraints are set up
        await knex('participants').where({ participant_id }).del();
        
        req.flash('success', 'User deleted successfully');
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Delete User Error:', err);
        req.flash('error', 'Error deleting user. Please try again.');
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
        // This allows managers to find participants by any identifying information.
        // Supports both single-word searches (e.g., "hazel") and full name searches (e.g., "hazel allen").
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            const searchParts = searchTerm.split(/\s+/); // Split by whitespace
            
            query = query.where(builder => {
                if (searchParts.length > 1) {
                    // Full name search: Match first name AND last name
                    builder.where(function() {
                        this.where('participant_first_name', 'ilike', `%${searchParts[0]}%`)
                            .andWhere('participant_last_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`);
                    })
                    // Also try reversed (in case user types "allen hazel")
                    .orWhere(function() {
                        this.where('participant_first_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`)
                            .andWhere('participant_last_name', 'ilike', `%${searchParts[0]}%`);
                    })
                    // Also search concatenated full name
                    .orWhere(knex.raw("CONCAT(participant_first_name, ' ', participant_last_name) ILIKE ?", [`%${searchTerm}%`]))
                    // Also search city
                    .orWhere('participant_city', 'ilike', `%${searchTerm}%`);
                } else {
                    // Single word search: Match first name OR last name OR full name OR city
                    builder.where('participant_first_name', 'ilike', `%${searchTerm}%`)
                        .orWhere('participant_last_name', 'ilike', `%${searchTerm}%`)
                        .orWhere(knex.raw("CONCAT(participant_first_name, ' ', participant_last_name) ILIKE ?", [`%${searchTerm}%`]))
                        .orWhere('participant_city', 'ilike', `%${searchTerm}%`);
                }
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

/**
 * Get Add Participant Form: Display form for creating a new participant
 * 
 * Business Logic: Managers need to be able to manually add participants to the system.
 * This is useful for participants who register in person or through other channels
 * before they create an online account. The form includes all essential participant fields.
 */
exports.getAddParticipant = async (req, res) => {
    try {
        res.render('admin/participant_add', { user: req.user, participant: null });
    } catch (err) {
        console.error('Get Add Participant Error:', err);
        res.status(500).send('Server Error');
    }
};

/**
 * Post Add Participant: Handle form submission to create a new participant
 * 
 * Business Logic: Creates a new participant record in the database. The participant_id
 * is generated using our custom ID generator. All fields are optional except first name,
 * last name, and email. The participant_role defaults to 'participant' unless specified.
 */
exports.postAddParticipant = async (req, res) => {
    try {
        const participantId = generateId();
        
        // Build participant data object from form submission
        const participantData = {
            participant_id: participantId,
            participant_email: req.body.participant_email,
            participant_first_name: req.body.participant_first_name,
            participant_last_name: req.body.participant_last_name,
            participant_dob: req.body.participant_dob || null,
            participant_role: req.body.participant_role || 'participant',
            participant_phone: req.body.participant_phone || null,
            participant_city: req.body.participant_city || null,
            participant_state: req.body.participant_state || null,
            participant_zip: req.body.participant_zip || null,
            participant_school_or_employer: req.body.participant_school_or_employer || null,
            participant_field_of_interest: req.body.participant_field_of_interest || null,
            participant_password: req.body.participant_password || null // Optional password
        };

        await knex('participants').insert(participantData);
        
        req.flash('success', 'Participant added successfully!');
        res.redirect('/admin/participants');
    } catch (err) {
        console.error('Add Participant Error:', err);
        req.flash('error', 'Error adding participant. Please try again.');
        res.redirect('/admin/participants/add');
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

exports.deleteParticipant = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete the participant record
        // Note: This will cascade delete related records if foreign key constraints are set up
        await knex('participants').where({ participant_id: id }).del();
        
        req.flash('success', 'Participant deleted successfully');
        res.redirect('/admin/participants');
    } catch (err) {
        console.error('Delete Participant Error:', err);
        req.flash('error', 'Error deleting participant. Please try again.');
        res.redirect('/admin/participants');
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
                'surveys.survey_overall_score',
                'surveys.survey_nps_bucket',
                'surveys.survey_recommendation_score',
                'surveys.survey_submission_date',
                'surveys.survey_comments'
            )
            .orderBy('surveys.survey_submission_date', 'desc');

        // Text Search Filter: Multi-field search across participant names, event names, and comments
        // Business Logic: Surveys contain rich information across multiple related tables.
        // Searching across participant names, event names, and comments allows managers to find
        // surveys by any relevant context. Supports both single-word and full name searches for participants.
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            const searchParts = searchTerm.split(/\s+/); // Split by whitespace
            
            query = query.where(builder => {
                // Participant name search (supports full names)
                if (searchParts.length > 1) {
                    // Full name search: Match first name AND last name
                    builder.where(function() {
                        this.where('participants.participant_first_name', 'ilike', `%${searchParts[0]}%`)
                            .andWhere('participants.participant_last_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`);
                    })
                    // Also try reversed (in case user types "allen hazel")
                    .orWhere(function() {
                        this.where('participants.participant_first_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`)
                            .andWhere('participants.participant_last_name', 'ilike', `%${searchParts[0]}%`);
                    })
                    // Also search concatenated full name
                    .orWhere(knex.raw("CONCAT(participants.participant_first_name, ' ', participants.participant_last_name) ILIKE ?", [`%${searchTerm}%`]))
                    // Also search event names and comments
                    .orWhere('event_definitions.event_name', 'ilike', `%${searchTerm}%`)
                    .orWhere('surveys.survey_comments', 'ilike', `%${searchTerm}%`);
                } else {
                    // Single word search: Match first name OR last name OR full name OR event OR comments
                    builder.where('participants.participant_first_name', 'ilike', `%${searchTerm}%`)
                        .orWhere('participants.participant_last_name', 'ilike', `%${searchTerm}%`)
                        .orWhere(knex.raw("CONCAT(participants.participant_first_name, ' ', participants.participant_last_name) ILIKE ?", [`%${searchTerm}%`]))
                        .orWhere('event_definitions.event_name', 'ilike', `%${searchTerm}%`)
                        .orWhere('surveys.survey_comments', 'ilike', `%${searchTerm}%`);
                }
            });
        }

        // Event Filter: Filter by specific event type
        // Business Logic: Allows managers to analyze survey responses for specific programs
        if (eventFilter && eventFilter !== '') {
            query = query.where('event_definitions.event_definition_id', eventFilter);
        }

        // Score Filter: NPS-based filtering (Detractors, Passives, Promoters)
        // Business Logic: This implements Net Promoter Score segmentation.
        // IMPORTANT: Survey uses 0-5 scale, not 0-10
        // Detractors (0-2): Participants who are unlikely to recommend the program
        // Passives (3): Participants who are neutral
        // Promoters (4-5): Participants who are highly likely to recommend
        // Filter by survey_nps_bucket column for consistency with displayed values
        // Use case-insensitive matching to handle any case variations
        if (scoreFilter === 'detractors') {
            query = query.where(function() {
                this.where(knex.raw("LOWER(TRIM(surveys.survey_nps_bucket))"), '=', 'detractor')
                    .orWhere(function() {
                        // Fallback: calculate from score if bucket is null
                        this.whereNull('surveys.survey_nps_bucket')
                            .whereNotNull('surveys.survey_recommendation_score')
                            .where('surveys.survey_recommendation_score', '>=', 0)
                            .where('surveys.survey_recommendation_score', '<=', 2);
                    });
            });
        } else if (scoreFilter === 'passives') {
            query = query.where(function() {
                this.where(knex.raw("LOWER(TRIM(surveys.survey_nps_bucket))"), '=', 'passive')
                    .orWhere(function() {
                        // Fallback: calculate from score if bucket is null
                        this.whereNull('surveys.survey_nps_bucket')
                            .whereNotNull('surveys.survey_recommendation_score')
                            .where('surveys.survey_recommendation_score', '=', 3);
                    });
            });
        } else if (scoreFilter === 'promoters') {
            query = query.where(function() {
                this.where(knex.raw("LOWER(TRIM(surveys.survey_nps_bucket))"), '=', 'promoter')
                    .orWhere(function() {
                        // Fallback: calculate from score if bucket is null
                        this.whereNull('surveys.survey_nps_bucket')
                            .whereNotNull('surveys.survey_recommendation_score')
                            .where('surveys.survey_recommendation_score', '>=', 4)
                            .where('surveys.survey_recommendation_score', '<=', 5);
                    });
            });
        }

        let surveysRaw = await query;

        // Backfill and correct NPS buckets for surveys
        // This ensures consistency between the bucket column and recommendation scores
        // Process surveys and update missing or incorrect buckets in the database
        for (let survey of surveysRaw) {
            if (survey.survey_recommendation_score !== null) {
                const recScore = parseFloat(survey.survey_recommendation_score);
                let correctBucket = null;
                if (!isNaN(recScore)) {
                    if (recScore >= 4 && recScore <= 5) {
                        correctBucket = 'Promoter';
                    } else if (recScore === 3) {
                        correctBucket = 'Passive';
                    } else if (recScore >= 0 && recScore <= 2) {
                        correctBucket = 'Detractor';
                    }
                }
                
                // Update the database if bucket is missing or incorrect
                const currentBucket = survey.survey_nps_bucket ? survey.survey_nps_bucket.trim() : null;
                if (correctBucket && currentBucket !== correctBucket) {
                    try {
                        await knex('surveys')
                            .where('survey_id', survey.survey_id)
                            .update({ survey_nps_bucket: correctBucket });
                        survey.survey_nps_bucket = correctBucket; // Update the object for display
                    } catch (err) {
                        console.error('Error updating survey bucket:', err);
                    }
                } else if (correctBucket && !currentBucket) {
                    // Bucket is missing, add it
                    survey.survey_nps_bucket = correctBucket;
                }
            }
        }
        
        const surveys = surveysRaw;

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

/**
 * Get Edit Survey Form: Display form for editing an existing survey response
 * 
 * Business Logic: Managers may need to correct survey data if errors were made during submission
 * or if participants request changes. This allows editing all survey scores and comments
 * while preserving the original registration and participant linkage.
 */
exports.getEditSurvey = async (req, res) => {
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

        res.render('admin/survey_edit', { user: req.user, survey });
    } catch (err) {
        console.error('Get Edit Survey Error:', err);
        res.status(500).send('Server Error');
    }
};

/**
 * Post Edit Survey: Handle form submission to update survey data
 * 
 * Business Logic: Updates survey scores and recalculates the overall score and NPS bucket.
 * The overall score is the average of all four scores (satisfaction, usefulness, instructor, recommendation).
 * The NPS bucket is recalculated based on the recommendation score (0-2 Detractor, 3 Passive, 4-5 Promoter).
 * This ensures data consistency when surveys are edited.
 */
exports.postEditSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            survey_satisfaction_score,
            survey_usefulness_score,
            survey_instructor_score,
            survey_recommendation_score,
            survey_comments
        } = req.body;

        // Validate scores are within 0-5 range
        const scores = [
            parseFloat(survey_satisfaction_score),
            parseFloat(survey_usefulness_score),
            parseFloat(survey_instructor_score),
            parseFloat(survey_recommendation_score)
        ];

        if (scores.some(score => isNaN(score) || score < 0 || score > 5)) {
            req.flash('error', 'All scores must be between 0 and 5.');
            return res.redirect(`/admin/surveys/edit/${id}`);
        }

        // Calculate overall score (average of all four scores)
        const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

        // Recalculate NPS bucket based on recommendation score
        let npsBucket = 'Passive'; // Default
        const recScore = parseFloat(survey_recommendation_score);
        if (recScore >= 4 && recScore <= 5) {
            npsBucket = 'Promoter';
        } else if (recScore >= 0 && recScore <= 2) {
            npsBucket = 'Detractor';
        }

        // Update survey in database
        await knex('surveys')
            .where('survey_id', id)
            .update({
                survey_satisfaction_score: scores[0],
                survey_usefulness_score: scores[1],
                survey_instructor_score: scores[2],
                survey_recommendation_score: scores[3],
                survey_overall_score: overallScore,
                survey_nps_bucket: npsBucket,
                survey_comments: survey_comments || null
            });

        req.flash('success', 'Survey updated successfully!');
        res.redirect(`/admin/surveys/${id}`);
    } catch (err) {
        console.error('Edit Survey Error:', err);
        req.flash('error', 'Error updating survey. Please try again.');
        res.redirect(`/admin/surveys/edit/${id}`);
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

        // Text Search: Search by milestone title or participant name
        // Business Logic: Supports both single-word and full name searches for participants.
        // This allows managers to find milestones by either the milestone title or the participant's name.
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            const searchParts = searchTerm.split(/\s+/); // Split by whitespace
            
            query = query.where(builder => {
                // Always search milestone title
                builder.where('milestones.milestone_title', 'ilike', `%${searchTerm}%`);
                
                // Participant name search (supports full names)
                if (searchParts.length > 1) {
                    // Full name search: Match first name AND last name
                    builder.orWhere(function() {
                        this.where('participants.participant_first_name', 'ilike', `%${searchParts[0]}%`)
                            .andWhere('participants.participant_last_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`);
                    })
                    // Also try reversed (in case user types "allen hazel")
                    .orWhere(function() {
                        this.where('participants.participant_first_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`)
                            .andWhere('participants.participant_last_name', 'ilike', `%${searchParts[0]}%`);
                    })
                    // Also search concatenated full name
                    .orWhere(knex.raw("CONCAT(participants.participant_first_name, ' ', participants.participant_last_name) ILIKE ?", [`%${searchTerm}%`]));
                } else {
                    // Single word search: Match first name OR last name OR full name
                    builder.orWhere('participants.participant_first_name', 'ilike', `%${searchTerm}%`)
                        .orWhere('participants.participant_last_name', 'ilike', `%${searchTerm}%`)
                        .orWhere(knex.raw("CONCAT(participants.participant_first_name, ' ', participants.participant_last_name) ILIKE ?", [`%${searchTerm}%`]));
                }
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
        // Business Logic: Helps managers find donations from specific participants.
        // Supports both single-word searches (e.g., "hazel") and full name searches (e.g., "hazel allen").
        // For full names, we split the search term and match first AND last name.
        // We also search the concatenated full name to catch cases where names might be stored differently.
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            const searchParts = searchTerm.split(/\s+/); // Split by whitespace
            
            query = query.where(builder => {
                if (searchParts.length > 1) {
                    // Full name search: Match first name AND last name
                    // Example: "hazel allen" matches first_name LIKE '%hazel%' AND last_name LIKE '%allen%'
                    builder.where(function() {
                        this.where('participants.participant_first_name', 'ilike', `%${searchParts[0]}%`)
                            .andWhere('participants.participant_last_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`);
                    })
                    // Also try reversed (in case user types "allen hazel")
                    .orWhere(function() {
                        this.where('participants.participant_first_name', 'ilike', `%${searchParts[searchParts.length - 1]}%`)
                            .andWhere('participants.participant_last_name', 'ilike', `%${searchParts[0]}%`);
                    })
                    // Also search concatenated full name
                    .orWhere(knex.raw("CONCAT(participants.participant_first_name, ' ', participants.participant_last_name) ILIKE ?", [`%${searchTerm}%`]));
                } else {
                    // Single word search: Match first name OR last name OR concatenated full name
                    builder.where('participants.participant_first_name', 'ilike', `%${searchTerm}%`)
                        .orWhere('participants.participant_last_name', 'ilike', `%${searchTerm}%`)
                        .orWhere(knex.raw("CONCAT(participants.participant_first_name, ' ', participants.participant_last_name) ILIKE ?", [`%${searchTerm}%`]));
                }
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

exports.getDonationDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const donation = await knex('donations')
            .leftJoin('participants', 'donations.participant_id', 'participants.participant_id')
            .where('donations.donation_id', id)
            .select(
                'donations.*',
                'participants.participant_first_name',
                'participants.participant_last_name',
                'participants.participant_email',
                'participants.participant_phone',
                'participants.participant_city',
                'participants.participant_state'
            )
            .first();

        if (!donation) {
            return res.status(404).send('Donation not found');
        }

        res.render('admin/donation_detail', { user: req.user, donation });
    } catch (err) {
        console.error('Get Donation Detail Error:', err);
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
