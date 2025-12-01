const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

exports.getLanding = (req, res) => {
    res.render('index', { user: req.session.user });
};

exports.getEvents = async (req, res) => {
    try {
        const events = await knex('event_occurrence')
            .join('event_template', 'event_occurrence.template_id', 'event_template.template_id')
            .select('*')
            .where('start_time', '>', new Date())
            .orderBy('start_time', 'asc');

        res.render('events', { user: req.session.user, events });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getDonate = (req, res) => {
    res.render('donate', { user: req.session.user });
};

exports.postDonate = async (req, res) => {
    const { amount, donor_name, email } = req.body;
    try {
        // In a real app, we would process payment here.
        // For now, we just record it. 
        // Note: The prompt schema has participant_id for donations. 
        // If this is a public donation, it might not be linked to a participant.
        // The schema allows participant_id to be nullable (implied or we should check).
        // Looking at my migration: table.integer('participant_id').unsigned(); -> It is nullable by default in Knex unless .notNullable() is called.

        await knex('donation').insert({
            amount,
            date: new Date(),
            participant_id: null // Public donation
        });

        res.send('<h1>Thank you for your donation!</h1><a href="/">Return Home</a>');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing donation');
    }
};
