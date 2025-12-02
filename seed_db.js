const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
    host: process.env.RDS_HOSTNAME || 'localhost',
    user: 'ella_admin',
    password: 'ella_password',
    database: 'ella_rises',
    port: 5434,
});

async function seed() {
    try {
        await client.connect();
        console.log('Connected to database for seeding...');

        // 1. Users
        const saltRounds = 10;
        const adminHash = await bcrypt.hash('admin', saltRounds);
        const userHash = await bcrypt.hash('user', saltRounds);

        await client.query(`
            INSERT INTO app_user (username, password_hash, role) VALUES
            ('admin', $1, 'Manager'),
            ('user', $2, 'Common')
            ON CONFLICT (username) DO NOTHING;
        `, [adminHash, userHash]);
        console.log('Users seeded.');

        // 2. Milestone Types
        await client.query(`
            INSERT INTO milestone_type (name, description) VALUES
            ('High School Graduation', 'Graduated from high school'),
            ('College Acceptance', 'Accepted into a college or university'),
            ('Internship', 'Secured an internship in a STEAM field'),
            ('Scholarship', 'Awarded a scholarship'),
            ('Community Service', 'Completed 50 hours of community service')
        `);
        console.log('Milestone Types seeded.');

        // 3. Event Templates
        await client.query(`
            INSERT INTO event_template (event_name, event_type, description) VALUES
            ('Intro to Coding', 'STEAM', 'Learn the basics of Python'),
            ('Mariachi Ensemble', 'Mariachi', 'Weekly practice for the ensemble'),
            ('Leadership Summit', 'Leadership', 'Annual leadership conference'),
            ('Robotics Workshop', 'STEAM', 'Build and program a robot')
        `);
        console.log('Event Templates seeded.');

        // 4. Participants
        await client.query(`
            INSERT INTO participant (email, first_name, last_name, generation_status, household_income_bracket, phone) VALUES
            ('maria@example.com', 'Maria', 'Gonzalez', '1st', 'Low', '555-0101'),
            ('sofia@example.com', 'Sofia', 'Rodriguez', '2nd', 'Medium', '555-0102'),
            ('lucia@example.com', 'Lucia', 'Martinez', '1st', 'Low', '555-0103')
        `);
        console.log('Participants seeded.');

        // 5. Event Occurrences (Need IDs from templates)
        // Assuming IDs 1-4 based on insertion order
        await client.query(`
            INSERT INTO event_occurrence (template_id, start_time, end_time, location) VALUES
            (1, '2023-10-15 10:00:00', '2023-10-15 12:00:00', 'Room 101'),
            (2, '2023-10-20 16:00:00', '2023-10-20 18:00:00', 'Music Hall'),
            (3, '2023-11-05 09:00:00', '2023-11-05 17:00:00', 'Main Auditorium')
        `);
        console.log('Event Occurrences seeded.');

        // 6. Registrations (Link participants to events)
        await client.query(`
            INSERT INTO registration (participant_id, occurrence_id) VALUES
            (1, 1), (2, 1), (3, 1), -- All in Coding
            (1, 2), -- Maria in Mariachi
            (2, 3)  -- Sofia in Leadership
        `);
        console.log('Registrations seeded.');

        // 7. Surveys
        await client.query(`
            INSERT INTO survey (registration_id, satisfaction_score, self_confidence_rating, comments) VALUES
            (1, 5, 4, 'Loved it!'),
            (2, 4, 3, 'Good but hard'),
            (3, 5, 5, 'Amazing experience')
        `);
        console.log('Surveys seeded.');

        // 8. Milestones
        await client.query(`
            INSERT INTO milestone (participant_id, type_id, date_achieved) VALUES
            (1, 1, '2023-05-20'), -- Maria HS Grad
            (2, 2, '2023-04-15')  -- Sofia College Accept
        `);
        console.log('Milestones seeded.');

        // 9. Donations
        await client.query(`
            INSERT INTO donation (participant_id, donor_name, donor_email, amount, date) VALUES
            (NULL, 'John Doe', 'john@example.com', 100.00, '2023-09-01'),
            (NULL, 'Jane Smith', 'jane@example.com', 250.00, '2023-10-01'),
            (1, NULL, NULL, 50.00, '2023-11-01') -- Donation linked to Maria
        `);
        console.log('Donations seeded.');

        await client.end();
    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    }
}

seed();
