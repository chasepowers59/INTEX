const knex = require('knex')(require('./knexfile').development);
const bcrypt = require('bcrypt');

async function seed() {
    try {
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

        // 2. Create Participants
        const participants = await knex('participant').insert([
            { email: 'maria.garcia@example.com', first_name: 'Maria', last_name: 'Garcia', generation_status: '1st', household_income_bracket: 'Low', phone: '555-0101', college_status: 'Enrolled', degree_type: 'STEAM', job_status: 'Student', job_field: 'None' },
            { email: 'sofia.rodriguez@example.com', first_name: 'Sofia', last_name: 'Rodriguez', generation_status: '2nd', household_income_bracket: 'Medium', phone: '555-0102', college_status: 'Graduated', degree_type: 'STEAM', job_status: 'Employed', job_field: 'STEAM' },
            { email: 'camila.hernandez@example.com', first_name: 'Camila', last_name: 'Hernandez', generation_status: '3rd', household_income_bracket: 'High', phone: '555-0103', college_status: 'Enrolled', degree_type: 'Non-STEAM', job_status: 'Student', job_field: 'None' },
            { email: 'isabella.martinez@example.com', first_name: 'Isabella', last_name: 'Martinez', generation_status: '1st', household_income_bracket: 'Low', phone: '555-0104', college_status: 'Not Attending', degree_type: 'None', job_status: 'Unemployed', job_field: 'None' },
            { email: 'valentina.lopez@example.com', first_name: 'Valentina', last_name: 'Lopez', generation_status: '2nd', household_income_bracket: 'Medium', phone: '555-0105', college_status: 'Graduated', degree_type: 'Non-STEAM', job_status: 'Employed', job_field: 'Non-STEAM' }
        ]).returning(['participant_id', 'first_name']);

        // 3. Create Event Templates
        const templates = await knex('event_template').insert([
            { event_name: 'Intro to Robotics', event_type: 'STEAM', description: 'Basic robotics workshop.' },
            { event_name: 'Mariachi Practice', event_type: 'Mariachi', description: 'Weekly practice session.' },
            { event_name: 'Leadership Summit', event_type: 'Leadership', description: 'Annual leadership conference.' }
        ]).returning(['template_id', 'event_name']);

        const steamTemplate = templates.find(t => t.event_name === 'Intro to Robotics');
        const mariachiTemplate = templates.find(t => t.event_name === 'Mariachi Practice');
        const leadershipTemplate = templates.find(t => t.event_name === 'Leadership Summit');

        // 4. Create Event Occurrences
        const occurrences = await knex('event_occurrence').insert([
            { template_id: steamTemplate.template_id, start_time: new Date('2023-12-10T10:00:00'), end_time: new Date('2023-12-10T12:00:00'), location: 'Room 101' },
            { template_id: mariachiTemplate.template_id, start_time: new Date('2023-12-12T18:00:00'), end_time: new Date('2023-12-12T20:00:00'), location: 'Auditorium' },
            { template_id: leadershipTemplate.template_id, start_time: new Date('2023-11-15T09:00:00'), end_time: new Date('2023-11-15T17:00:00'), location: 'Conference Hall' },
            { template_id: steamTemplate.template_id, start_time: new Date('2024-01-20T10:00:00'), end_time: new Date('2024-01-20T12:00:00'), location: 'Lab 2' },
            { template_id: mariachiTemplate.template_id, start_time: new Date('2024-01-22T18:00:00'), end_time: new Date('2024-01-22T20:00:00'), location: 'Auditorium' }
        ]).returning(['occurrence_id', 'template_id', 'start_time']);

        // 5. Data Linking
        const getPid = (name) => participants.find(p => p.first_name === name).participant_id;
        const pastLeadership = occurrences.find(o => o.template_id === leadershipTemplate.template_id);
        const futureSteam = occurrences.find(o => new Date(o.start_time) > new Date('2024-01-01'));

        await knex('registration').insert([
            { participant_id: getPid('Maria'), occurrence_id: pastLeadership.occurrence_id },
            { participant_id: getPid('Sofia'), occurrence_id: pastLeadership.occurrence_id },
            { participant_id: getPid('Camila'), occurrence_id: futureSteam.occurrence_id }
        ]);

        console.log('Seed completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding:', err);
        process.exit(1);
    }
}

seed();
