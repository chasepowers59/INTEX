const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

exports.getLanding = async (req, res) => {
    try {
        let registrations = [];
        if (req.session.user) {
            const appUser = await knex('app_user').where('user_id', req.session.user.user_id).first();
            if (appUser && appUser.participant_id) {
                registrations = await knex('registrations')
                    .join('event_instances', 'registrations.event_instance_id', 'event_instances.event_instance_id')
                    .join('event_definitions', 'event_instances.event_definition_id', 'event_definitions.event_definition_id')
                    .where('registrations.participant_id', appUser.participant_id)
                    .select('event_definitions.event_name', 'event_instances.event_date_time_start', 'registrations.registration_status');
            }
        }
        res.render('index', { user: req.session.user, registrations });
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

        res.render('events/list', { user: req.session.user, events });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getPrograms = async (req, res) => {
    try {
        const programs = await knex('event_definitions').select('*');
        res.render('programs', { user: req.session.user, programs });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getDonate = (req, res) => {
    res.render('donate', { user: req.session.user });
};

exports.postDonate = async (req, res) => {
    const { amount } = req.body;
    try {
        // Generate a random ID for now since it's not auto-increment
        const donationId = 'D' + Date.now().toString().slice(-9);
        await knex('donations').insert({
            donation_id: donationId,
            donation_amount: amount,
            donation_date: new Date(),
            participant_id: 'P001' // Hardcoded for now as per schema requirement (not null) - ideally would be null or linked to user
        });

        res.send('<h1>Thank you for your donation!</h1><a href="/">Return Home</a>');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing donation');
    }
};
