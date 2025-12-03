const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
const { generateId } = require('../utils/idGenerator');

exports.getLanding = async (req, res) => {
    try {
        let registrations = [];
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

exports.getPrograms = async (req, res) => {
    try {
        const programs = await knex('event_definitions').select('*');
        res.render('programs', { user: req.user, programs });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getDonate = (req, res) => {
    res.render('donate', { user: req.user });
};

exports.postDonate = async (req, res) => {
    const { amount, donor_first_name, donor_last_name, donor_email } = req.body;
    
    try {
        // Determine participant_id based on logged-in user
        const participantId = req.user ? req.user.participant_id : null;
        
        // Generate donation ID
        const donationId = generateId();
        
        // Insert donation into database
        await knex('donations').insert({
            donation_id: donationId,
            participant_id: participantId,
            donation_amount: amount,
            donation_date: new Date(),
            donor_first_name: donor_first_name,
            donor_last_name: donor_last_name,
            donor_email: donor_email
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
