const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

exports.getDashboard = (req, res) => {
    res.render('admin/dashboard', { user: req.session.user });
};

exports.getParticipants = async (req, res) => {
    const { search } = req.query;
    let query = knex('participant').select('*');

    if (search) {
        query = query.where('first_name', 'ilike', `%${search}%`)
            .orWhere('last_name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
    }

    try {
        const participants = await query;
        res.render('admin/participant_list', { user: req.session.user, participants, search });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getEvents = async (req, res) => {
    const { search } = req.query;
    let query = knex('event_occurrence')
        .join('event_template', 'event_occurrence.template_id', 'event_template.template_id')
        .select('*')
        .orderBy('start_time', 'desc');

    if (search) {
        query = query.where('event_name', 'ilike', `%${search}%`);
    }

    try {
        const events = await query;
        res.render('admin/event_list', { user: req.session.user, events, search });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.getParticipantDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const participant = await knex('participant').where('participant_id', id).first();
        if (!participant) {
            return res.status(404).send('Participant not found');
        }

        const milestones = await knex('milestone').where('participant_id', id).orderBy('date_achieved', 'desc');
        const donations = await knex('donation').where('participant_id', id).orderBy('date', 'desc');
        const registrations = await knex('registration')
            .join('event_occurrence', 'registration.occurrence_id', 'event_occurrence.occurrence_id')
            .join('event_template', 'event_occurrence.template_id', 'event_template.template_id')
            .where('registration.participant_id', id)
            .select('*');

        // Fetch surveys linked to registrations
        // This is a bit complex, might need a separate query or join.
        // For now, let's just get surveys for the participant's registrations.
        const surveys = await knex('survey')
            .join('registration', 'survey.registration_id', 'registration.registration_id')
            .where('registration.participant_id', id)
            .select('*');

        res.render('admin/participant_detail', {
            user: req.session.user,
            participant,
            milestones,
            donations,
            registrations,
            surveys
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// Forms
exports.getAddDonation = async (req, res) => {
    const participants = await knex('participant').select('participant_id', 'first_name', 'last_name');
    res.render('admin/forms/add_donation', { user: req.session.user, participants });
};

exports.postAddDonation = async (req, res) => {
    const { participant_id, amount, date } = req.body;
    try {
        await knex('donation').insert({ participant_id, amount, date });
        res.redirect(`/admin/participant/${participant_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding donation');
    }
};

exports.getAddMilestone = async (req, res) => {
    const participants = await knex('participant').select('participant_id', 'first_name', 'last_name');
    res.render('admin/forms/add_milestone', { user: req.session.user, participants });
};

exports.postAddMilestone = async (req, res) => {
    const { participant_id, title, date_achieved } = req.body;
    try {
        await knex('milestone').insert({ participant_id, title, date_achieved });
        res.redirect(`/admin/participant/${participant_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding milestone');
    }
};
