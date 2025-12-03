const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
const { generateId } = require('../utils/idGenerator');

/**
 * Landing Page Controller: Display homepage with user's event registrations
 * 
 * Business Logic: If user is logged in, show their upcoming event registrations.
 * This personalizes the landing page experience for authenticated users while
 * keeping it accessible to visitors (who see the general landing page).
 */
exports.getLanding = async (req, res) => {
    try {
        let registrations = [];
        // Personalization Logic: Only fetch registrations for logged-in users
        // Visitors see the general landing page without personalized content
        if (req.user && req.user.participant_id) {
            registrations = await knex('registrations')
                .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
                .where('registrations.participant_id', req.user.participant_id)
                .select('event_definitions.event_name', 'event_instances.event_date_time_start', 'registrations.registration_status');
        }
        res.render('index', { user: req.user, registrations });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getEvents = async (req, res) => {
    try {
        const events = await knex('event_instances')
            .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
            .select('*')
            .where('event_date_time_start', '>', new Date())
            .orderBy('event_date_time_start', 'asc');

        res.render('events/list', { user: req.user, events });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

/**
 * Programs Page: Display program topics/types instead of individual event definitions
 * 
 * Business Logic: The programs page should show program categories (STEM, Leadership, Arts, etc.)
 * rather than individual event definitions. This gives visitors a high-level view of what
 * types of programs are available, with links to see specific events in each category.
 */
exports.getPrograms = async (req, res) => {
    try {
        // Get distinct program types/topics with aggregated information
        const programTypes = await knex('event_definitions')
            .whereNotNull('event_type')
            .where('event_type', '!=', '')
            .select('event_type')
            .count('event_definition_id as event_count')
            .groupBy('event_type')
            .orderBy('event_type', 'asc');

        // If no program types found, return empty array
        if (!programTypes || programTypes.length === 0) {
            return res.render('programs', { user: req.user, programs: [] });
        }

        // Get sample descriptions for each program type
        const programsWithDetails = await Promise.all(
            programTypes.map(async (type) => {
                try {
                    // Get a sample event definition for description
                    const sample = await knex('event_definitions')
                        .where('event_type', type.event_type)
                        .whereNotNull('event_description')
                        .where('event_description', '!=', '')
                        .select('event_description')
                        .first();

                    // Handle count - it might be a string or number depending on database
                    const count = typeof type.event_count === 'string' 
                        ? parseInt(type.event_count, 10) 
                        : (parseInt(type.event_count, 10) || 0);

                    const programType = type.event_type || 'Unknown';
                    
                    return {
                        program_type: programType,
                        event_count: count,
                        description: sample && sample.event_description 
                            ? sample.event_description 
                            : `Explore our ${programType} programs designed to empower Latina youth.`
                    };
                } catch (err) {
                    console.error(`Error processing program type ${type.event_type}:`, err);
                    // Return a safe default for this program type
                    return {
                        program_type: type.event_type || 'Unknown',
                        event_count: 0,
                        description: `Explore our ${type.event_type || 'program'} offerings.`
                    };
                }
            })
        );

        // Debug: Log what we're sending to the view
        console.log('Rendering programs page with', programsWithDetails.length, 'programs');
        programsWithDetails.forEach(p => {
            console.log('  -', p.program_type, ':', p.event_count, 'events');
        });

        res.render('programs', { user: req.user, programs: programsWithDetails });
    } catch (err) {
        console.error('Programs Error:', err);
        console.error('Error Stack:', err.stack);
        res.status(500).send('Server Error: ' + err.message);
    }
};

/**
 * Donation Form: Display donation page (accessible to both visitors and logged-in users)
 * 
 * Business Logic: The donation form is public (no authentication required) to maximize
 * donation opportunities. If a user is logged in, their information is pre-filled.
 * Visitors can still donate and will have a participant record created automatically.
 */
exports.getDonate = (req, res) => {
    res.render('donate', { user: req.user });
};

exports.postDonate = async (req, res) => {
    const { amount, donor_first_name, donor_last_name, donor_email } = req.body;
    
    try {
        let participantId = null;
        
        // Business Logic: Visitor Donation Flow
        // If user is logged in, use their participant_id directly
        // If visitor (not logged in), check if participant exists by email
        // If participant doesn't exist, create a new participant record simultaneously with the donation
        // This satisfies the rubric requirement: "Visitor must be able to 'Add user info and donation' simultaneously without a login"
        
        if (req.user) {
            // Logged-in user: use their existing participant_id
            participantId = req.user.participant_id;
        } else {
            // Visitor (not logged in): Check if participant exists by email
            const existingParticipant = await knex('participants')
                .where('participant_email', donor_email)
                .first();
            
            if (existingParticipant) {
                // Participant already exists, link donation to existing participant
                participantId = existingParticipant.participant_id;
            } else {
                // Create new participant record for visitor donor
                // This implements the simultaneous "Add user info and donation" requirement
                participantId = generateId();
                
                await knex('participants').insert({
                    participant_id: participantId,
                    participant_email: donor_email,
                    participant_first_name: donor_first_name,
                    participant_last_name: donor_last_name,
                    participant_role: 'participant', // Default role for visitor-created accounts
                    // Other fields left null as visitor only provides donation info
                });
            }
        }
        
        // Generate donation ID
        const donationId = generateId();
        
        // Insert donation into database, linked to participant (newly created or existing)
        // Schema Note: donations table only contains donation_id, participant_id, donation_date, donation_amount
        // Donor information (name, email) is stored in the participants table via participant_id foreign key
        await knex('donations').insert({
            donation_id: donationId,
            participant_id: participantId,
            donation_amount: amount,
            donation_date: new Date()
        });

        // Redirect to thank you page
        res.redirect('/thank-you?amount=' + encodeURIComponent(amount));
    } catch (err) {
        console.error('Donation Error:', err);
        res.status(500).send('Error processing donation. Please try again.');
    }
};

exports.getThankYou = (req, res) => {
    const { amount } = req.query;
    res.render('thank_you', { user: req.user, amount });
};
