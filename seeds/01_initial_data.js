const bcrypt = require('bcrypt');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
    // Deletes ALL existing entries
    await knex('donations').del();
    await knex('milestones').del();
    await knex('surveys').del();
    await knex('registrations').del();
    await knex('event_instances').del();
    await knex('event_definitions').del();
    await knex('participants').del();
    await knex('app_user').del();

    // 1. App Users
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('password', saltRounds);

    await knex('app_user').insert([
        { username: 'admin', password_hash: passwordHash, role: 'Manager' },
        { username: 'volunteer', password_hash: passwordHash, role: 'Common' }
    ]);

    // 2. Participants
    // Demographics: Hispanic/Latina, 1st/2nd Gen (simulated in bio or fields if available, otherwise just implied by names/context)
    await knex('participants').insert([
        {
            participant_id: 'PART-001',
            participant_first_name: 'Maria',
            participant_last_name: 'Gonzalez',
            participant_email: 'maria.g@example.com',
            participant_city: 'Provo',
            participant_role: 'Student',
            participant_field_of_interest: 'STEAM, Robotics',
            participant_school_or_employer: 'Provo High School'
        },
        {
            participant_id: 'PART-002',
            participant_first_name: 'Sofia',
            participant_last_name: 'Rodriguez',
            participant_email: 'sofia.r@example.com',
            participant_city: 'Orem',
            participant_role: 'Student',
            participant_field_of_interest: 'Music, Mariachi',
            participant_school_or_employer: 'Orem High School'
        },
        {
            participant_id: 'PART-003',
            participant_first_name: 'Elena',
            participant_last_name: 'Martinez',
            participant_email: 'elena.m@example.com',
            participant_city: 'Lehi',
            participant_role: 'Student',
            participant_field_of_interest: 'Engineering, Math',
            participant_school_or_employer: 'Skyridge High School'
        },
        {
            participant_id: 'PART-004',
            participant_first_name: 'Isabella',
            participant_last_name: 'Hernandez',
            participant_email: 'isa.h@example.com',
            participant_city: 'Provo',
            participant_role: 'Mentor',
            participant_field_of_interest: 'Computer Science',
            participant_school_or_employer: 'BYU'
        }
    ]);

    // 3. Event Definitions
    await knex('event_definitions').insert([
        {
            event_definition_id: 'DEF-001',
            event_name: 'Mariachi Workshop',
            event_type: 'Mariachi',
            event_description: 'Weekly practice for the Mariachi ensemble, focusing on traditional instruments and vocals.',
            event_recurrence_pattern: 'Weekly',
            event_default_capacity: 30
        },
        {
            event_definition_id: 'DEF-002',
            event_name: 'Robotics Lab @ UVU',
            event_type: 'STEAM',
            event_description: 'Hands-on robotics workshop hosted by UVU Engineering department.',
            event_recurrence_pattern: 'Monthly',
            event_default_capacity: 20
        },
        {
            event_definition_id: 'DEF-003',
            event_name: 'Engineering Tomorrow @ BYU',
            event_type: 'STEAM',
            event_description: 'Explore civil and mechanical engineering concepts with BYU professors.',
            event_recurrence_pattern: 'Annually',
            event_default_capacity: 50
        },
        {
            event_definition_id: 'DEF-004',
            event_name: 'Mentoring with Women in Tech',
            event_type: 'Leadership',
            event_description: 'Networking and mentorship session with local women leaders in technology.',
            event_recurrence_pattern: 'Quarterly',
            event_default_capacity: 40
        },
        {
            event_definition_id: 'DEF-005',
            event_name: 'Cultural Art Showcase',
            event_type: 'Heritage',
            event_description: 'Showcasing traditional art forms and history.',
            event_recurrence_pattern: 'Annually',
            event_default_capacity: 100
        }
    ]);

    // 4. Event Instances
    await knex('event_instances').insert([
        {
            event_instance_id: 'EVT-001',
            event_definition_id: 'DEF-001', // Mariachi
            event_date_time_start: '2026-10-15 16:00:00',
            event_date_time_end: '2026-10-15 18:00:00',
            event_location: 'Community Center Hall A',
            event_capacity: 30
        },
        {
            event_instance_id: 'EVT-002',
            event_definition_id: 'DEF-002', // Robotics
            event_date_time_start: '2026-10-20 09:00:00',
            event_date_time_end: '2026-10-20 12:00:00',
            event_location: 'UVU Science Building',
            event_capacity: 20
        },
        {
            event_instance_id: 'EVT-003',
            event_definition_id: 'DEF-004', // Mentoring
            event_date_time_start: '2026-11-05 18:00:00',
            event_date_time_end: '2026-11-05 20:00:00',
            event_location: 'Silicon Slopes HQ',
            event_capacity: 40
        }
    ]);

    // 5. Registrations
    await knex('registrations').insert([
        {
            registration_id: 'REG-001',
            participant_id: 'PART-001', // Maria
            event_instance_id: 'EVT-002', // Robotics
            registration_status: 'Attended',
            registration_attended_flag: 1
        },
        {
            registration_id: 'REG-002',
            participant_id: 'PART-002', // Sofia
            event_instance_id: 'EVT-001', // Mariachi
            registration_status: 'Attended',
            registration_attended_flag: 1
        },
        {
            registration_id: 'REG-003',
            participant_id: 'PART-003', // Elena
            event_instance_id: 'EVT-002', // Robotics
            registration_status: 'Registered',
            registration_attended_flag: 0
        },
        {
            registration_id: 'REG-004',
            participant_id: 'PART-001', // Maria
            event_instance_id: 'EVT-003', // Mentoring
            registration_status: 'Attended',
            registration_attended_flag: 1
        }
    ]);

    // 6. Surveys
    // Impact Metrics: Satisfaction, Usefulness, Recommendation (NPS)
    await knex('surveys').insert([
        {
            survey_id: 'SUR-001',
            registration_id: 'REG-001', // Maria - Robotics
            survey_satisfaction_score: 5.0, // 1-5 scale assumed or normalized
            survey_usefulness_score: 5.0,
            survey_recommendation_score: 10.0, // NPS 1-10
            survey_comments: 'I loved building the robot! I want to be an engineer.',
            survey_submission_date: '2023-10-21 10:00:00'
        },
        {
            survey_id: 'SUR-002',
            registration_id: 'REG-002', // Sofia - Mariachi
            survey_satisfaction_score: 4.5,
            survey_usefulness_score: 4.0,
            survey_recommendation_score: 9.0,
            survey_comments: 'Great practice, learned a lot.',
            survey_submission_date: '2023-10-16 09:00:00'
        },
        {
            survey_id: 'SUR-003',
            registration_id: 'REG-004', // Maria - Mentoring
            survey_satisfaction_score: 4.8,
            survey_usefulness_score: 5.0,
            survey_recommendation_score: 10.0,
            survey_comments: 'So inspiring to meet women leaders.',
            survey_submission_date: '2023-11-06 11:00:00'
        }
    ]);

    // 7. Milestones
    // Higher Ed & Success Metrics
    await knex('milestones').insert([
        {
            milestone_id: 'MIL-001',
            participant_id: 'PART-001', // Maria
            milestone_title: 'FAFSA Completed',
            milestone_date: '2023-10-01'
        },
        {
            milestone_id: 'MIL-002',
            participant_id: 'PART-004', // Isabella (Mentor/Alumni)
            milestone_title: 'Accepted to College',
            milestone_date: '2020-04-15'
        },
        {
            milestone_id: 'MIL-003',
            participant_id: 'PART-003', // Elena
            milestone_title: 'Calculus Class Completed',
            milestone_date: '2023-05-20'
        }
    ]);
};
