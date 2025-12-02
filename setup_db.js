const { Client } = require('pg');

const client = new Client({
    host: process.env.RDS_HOSTNAME || 'localhost',
    user: 'ella_admin',
    password: 'ella_password',
    database: 'ella_rises',
    port: 5434,
});

const schemaSql = `
-- Drop tables if they exist (reverse order of dependencies)
DROP TABLE IF EXISTS donation;
DROP TABLE IF EXISTS milestone;
DROP TABLE IF EXISTS milestone_type;
DROP TABLE IF EXISTS survey;
DROP TABLE IF EXISTS registration;
DROP TABLE IF EXISTS event_occurrence;
DROP TABLE IF EXISTS event_template;
DROP TABLE IF EXISTS participant;
DROP TABLE IF EXISTS app_user;

-- Create Tables
CREATE TABLE app_user (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Common' CHECK (role IN ('Manager', 'Common'))
);

CREATE TABLE participant (
    participant_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    generation_status VARCHAR(50) NOT NULL CHECK (generation_status IN ('1st', '2nd', '3rd')),
    household_income_bracket VARCHAR(255),
    phone VARCHAR(50)
);

CREATE TABLE event_template (
    template_id SERIAL PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('STEAM', 'Mariachi', 'Leadership')),
    description TEXT
);

CREATE TABLE event_occurrence (
    occurrence_id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES event_template(template_id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255)
);

CREATE TABLE registration (
    registration_id SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL REFERENCES participant(participant_id) ON DELETE CASCADE,
    occurrence_id INTEGER NOT NULL REFERENCES event_occurrence(occurrence_id) ON DELETE CASCADE,
    UNIQUE(participant_id, occurrence_id)
);

CREATE TABLE survey (
    survey_id SERIAL PRIMARY KEY,
    registration_id INTEGER NOT NULL REFERENCES registration(registration_id) ON DELETE CASCADE,
    satisfaction_score INTEGER,
    self_confidence_rating INTEGER,
    comments TEXT
);

CREATE TABLE milestone_type (
    type_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE milestone (
    milestone_id SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL REFERENCES participant(participant_id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL REFERENCES milestone_type(type_id) ON DELETE CASCADE,
    date_achieved DATE NOT NULL
);

CREATE TABLE donation (
    donation_id SERIAL PRIMARY KEY,
    participant_id INTEGER REFERENCES participant(participant_id) ON DELETE SET NULL,
    donor_name VARCHAR(255),
    donor_email VARCHAR(255),
    amount DECIMAL(14, 2) NOT NULL,
    date DATE NOT NULL
);
`;

async function setup() {
    try {
        await client.connect();
        console.log('Connected to database.');

        console.log('Running schema setup...');
        await client.query(schemaSql);
        console.log('Schema created successfully!');

        await client.end();
    } catch (err) {
        console.error('Error setting up database:', err);
        process.exit(1);
    }
}

setup();
