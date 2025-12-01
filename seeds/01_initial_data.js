/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
    // Deletes ALL existing entries
    await knex('donation').del();
    await knex('milestone').del();
    await knex('survey').del();
    await knex('registration').del();
    await knex('event_occurrence').del();
    await knex('event_template').del();
    await knex('participant').del();
    await knex('app_user').del();

    // 1. Create Users
    const hashedPassword = await bcrypt.hash('password', 10);
    await knex('app_user').insert([
        { username: 'manager', password_hash: hashedPassword, role: 'Manager' },
        { username: 'guest', password_hash: hashedPassword, role: 'Common' }
    ]);

    // 2. Create Participants (5 Hispanic names)
    const participants = await knex('participant').insert([
        { email: 'maria.garcia@example.com', first_name: 'Maria', last_name: 'Garcia', generation_status: '1st', household_income_bracket: 'Low', phone: '555-0101' },
        { email: 'sofia.rodriguez@example.com', first_name: 'Sofia', last_name: 'Rodriguez', generation_status: '2nd', household_income_bracket: 'Medium', phone: '555-0102' },
        { email: 'camila.hernandez@example.com', first_name: 'Camila', last_name: 'Hernandez', generation_status: '3rd', household_income_bracket: 'High', phone: '555-0103' },
        { email: 'isabella.martinez@example.com', first_name: 'Isabella', last_name: 'Martinez', generation_status: '1st', household_income_bracket: 'Low', phone: '555-0104' },
        { email: 'valentina.lopez@example.com', first_name: 'Valentina', last_name: 'Lopez', generation_status: '2nd', household_income_bracket: 'Medium', phone: '555-0105' }
    ]).returning(['participant_id', 'first_name']);

    // 3. Create Event Templates (3 Types)
    const templates = await knex('event_template').insert([
        { event_name: 'Intro to Robotics', event_type: 'STEAM', description: 'Basic robotics workshop.' },
        { event_name: 'Mariachi Practice', event_type: 'Mariachi', description: 'Weekly practice session.' },
        { event_name: 'Leadership Summit', event_type: 'Leadership', description: 'Annual leadership conference.' }
    ]).returning(['template_id', 'event_name']);

    const steamTemplate = templates.find(t => t.event_name === 'Intro to Robotics');
    const mariachiTemplate = templates.find(t => t.event_name === 'Mariachi Practice');
    const leadershipTemplate = templates.find(t => t.event_name === 'Leadership Summit');

    // 4. Create Event Occurrences (5 Occurrences)
    const occurrences = await knex('event_occurrence').insert([
        { template_id: steamTemplate.template_id, start_time: new Date('2023-12-10T10:00:00'), end_time: new Date('2023-12-10T12:00:00'), location: 'Room 101' },
        { template_id: mariachiTemplate.template_id, start_time: new Date('2023-12-12T18:00:00'), end_time: new Date('2023-12-12T20:00:00'), location: 'Auditorium' },
        { template_id: leadershipTemplate.template_id, start_time: new Date('2023-11-15T09:00:00'), end_time: new Date('2023-11-15T17:00:00'), location: 'Conference Hall' }, // Past event
        { template_id: steamTemplate.template_id, start_time: new Date('2024-01-20T10:00:00'), end_time: new Date('2024-01-20T12:00:00'), location: 'Lab 2' },
        { template_id: mariachiTemplate.template_id, start_time: new Date('2024-01-22T18:00:00'), end_time: new Date('2024-01-22T20:00:00'), location: 'Auditorium' }
    ]).returning(['occurrence_id', 'template_id', 'start_time']);

    // 5. Data Linking (Registrations, Surveys, Milestones)

    // Helper to find ID by name
    const getPid = (name) => participants.find(p => p.first_name === name).participant_id;

    // Occurrences
    const pastLeadership = occurrences.find(o => o.template_id === leadershipTemplate.template_id);
    const futureSteam = occurrences.find(o => new Date(o.start_time) > new Date('2024-01-01'));

    // Registrations
    const registrations = await knex('registration').insert([
        { participant_id: getPid('Maria'), occurrence_id: pastLeadership.occurrence_id },
        { participant_id: getPid('Sofia'), occurrence_id: pastLeadership.occurrence_id },
        { participant_id: getPid('Camila'), occurrence_id: futureSteam.occurrence_id }
    ]).returning(['registration_id', 'participant_id']);

    // Surveys (Only for past events)
    const mariaReg = registrations.find(r => r.participant_id === getPid('Maria'));
    const sofiaReg = registrations.find(r => r.participant_id === getPid('Sofia'));

    await knex('survey').insert([
        { registration_id: mariaReg.registration_id, satisfaction_score: 9, self_confidence_rating: 8, comments: 'Loved it!' },
        { registration_id: sofiaReg.registration_id, satisfaction_score: 10, self_confidence_rating: 9, comments: 'Very inspiring.' }
    ]);

    // Milestones
    await knex('milestone').insert([
        { participant_id: getPid('Maria'), title: 'First Leadership Summit', date_achieved: new Date('2023-11-15') },
        { participant_id: getPid('Sofia'), title: 'Community Service Award', date_achieved: new Date('2023-10-01') }
    ]);

    // Donations
    await knex('donation').insert([
        { participant_id: getPid('Maria'), amount: 50.00, date: new Date('2023-11-01') },
        { participant_id: getPid('Isabella'), amount: 25.00, date: new Date('2023-12-01') },
        { participant_id: null, amount: 100.00, date: new Date('2023-11-15') } // Anonymous
    ]);
};
