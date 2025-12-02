/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('event_definitions', function (table) {
            table.string('event_definition_id', 10).primary();
            table.string('event_name', 255).notNullable();
            table.string('event_type', 100).notNullable();
            table.text('event_description');
            table.string('event_recurrence_pattern', 50);
            table.decimal('event_default_capacity', 10, 2).notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('event_instances', function (table) {
            table.string('event_instance_id', 10).primary();
            table.string('event_definition_id', 10).notNullable();
            table.foreign('event_definition_id').references('event_definitions.event_definition_id');
            table.timestamp('event_date_time_start').notNullable();
            table.timestamp('event_date_time_end').notNullable();
            table.string('event_location', 255);
            table.decimal('event_capacity', 10, 2);
            table.timestamp('event_registration_deadline');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('participants', function (table) {
            table.string('participant_id', 10).primary();
            table.string('participant_email', 255).notNullable().unique();
            table.string('participant_first_name', 100);
            table.string('participant_last_name', 100);
            table.date('participant_dob');
            table.string('participant_role', 50);
            table.string('participant_phone', 20);
            table.string('participant_city', 100);
            table.string('participant_state', 2);
            table.string('participant_zip', 10);
            table.string('participant_school_or_employer', 255);
            table.string('participant_field_of_interest', 100);
            // Adding STEAM outcomes columns here to consolidate
            // table.enum('college_status', ['Not Attending', 'Enrolled', 'Graduated']).defaultTo('Not Attending');
            // table.enum('degree_type', ['STEAM', 'Non-STEAM', 'None']).defaultTo('None');
            // table.enum('job_status', ['Unemployed', 'Employed', 'Student']).defaultTo('Student');
            // table.enum('job_field', ['STEAM', 'Non-STEAM', 'None']).defaultTo('None');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('registrations', function (table) {
            table.string('registration_id', 10).primary();
            table.string('participant_id', 10).notNullable();
            table.foreign('participant_id').references('participants.participant_id');
            table.string('event_instance_id', 10).notNullable();
            table.foreign('event_instance_id').references('event_instances.event_instance_id');
            table.string('registration_status', 50);
            table.decimal('registration_attended_flag', 1, 0);
            table.timestamp('registration_check_in_time');
            table.timestamp('registration_created_at');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.unique(['participant_id', 'event_instance_id']);
        })
        .createTable('surveys', function (table) {
            table.string('survey_id', 10).primary();
            table.string('registration_id', 10).notNullable().unique();
            table.foreign('registration_id').references('registrations.registration_id');
            table.decimal('survey_satisfaction_score', 3, 1);
            table.decimal('survey_usefulness_score', 3, 1);
            table.decimal('survey_instructor_score', 3, 1);
            table.decimal('survey_recommendation_score', 3, 1);
            table.decimal('survey_overall_score', 3, 2);
            table.string('survey_nps_bucket', 50);
            table.text('survey_comments');
            table.timestamp('survey_submission_date');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('milestones', function (table) {
            table.string('milestone_id', 10).primary();
            table.string('participant_id', 10).notNullable();
            table.foreign('participant_id').references('participants.participant_id');
            table.string('milestone_title', 255);
            table.date('milestone_date');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('donations', function (table) {
            table.string('donation_id', 10).primary();
            table.string('participant_id', 10).notNullable();
            table.foreign('participant_id').references('participants.participant_id');
            table.date('donation_date');
            table.decimal('donation_amount', 10, 2);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('app_user', function (table) {
            table.increments('user_id').primary();
            table.string('username').notNullable().unique();
            table.string('password_hash').notNullable();
            table.enum('role', ['Manager', 'Common']).notNullable().defaultTo('Common');
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('app_user')
        .dropTableIfExists('donations')
        .dropTableIfExists('milestones')
        .dropTableIfExists('surveys')
        .dropTableIfExists('registrations')
        .dropTableIfExists('participants')
        .dropTableIfExists('event_instances')
        .dropTableIfExists('event_definitions');
};
