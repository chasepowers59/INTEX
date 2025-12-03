/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('event_definitions', function (table) {
            table.integer('event_definition_id').primary();
            table.string('event_name', 255);
            table.string('event_type', 50);
            table.text('event_description');
            table.string('event_recurrence_pattern', 50);
            table.decimal('event_default_capacity', 10, 1);
        })
        .createTable('participants', function (table) {
            table.integer('participant_id').primary();
            table.string('participant_email', 255);
            table.string('participant_first_name', 100);
            table.string('participant_last_name', 100);
            table.date('participant_dob');
            table.string('participant_role', 50);
            table.string('participant_phone', 20);
            table.string('participant_city', 100);
            table.string('participant_state', 2);
            table.decimal('participant_zip', 10, 1);
            table.string('participant_school_or_employer', 255);
            table.string('participant_field_of_interest', 50);
            table.string('participant_password', 255);
        })
        .createTable('event_instances', function (table) {
            table.integer('event_instance_id').primary();
            table.integer('event_definition_id').references('event_definitions.event_definition_id');
            table.timestamp('event_date_time_start');
            table.timestamp('event_date_time_end');
            table.string('event_location', 255);
            table.decimal('event_capacity', 10, 1);
            table.timestamp('event_registration_deadline');
        })
        .createTable('registrations', function (table) {
            table.integer('registration_id').primary();
            table.integer('participant_id').references('participants.participant_id');
            table.integer('event_instance_id').references('event_instances.event_instance_id');
            table.string('registration_status', 50);
            table.boolean('registration_attended_flag');
            table.timestamp('registration_check_in_time');
            table.timestamp('registration_created_at');
        })
        .createTable('surveys', function (table) {
            table.integer('survey_id').primary();
            table.integer('registration_id').references('registrations.registration_id');
            table.integer('survey_satisfaction_score');
            table.integer('survey_usefulness_score');
            table.integer('survey_instructor_score');
            table.integer('survey_recommendation_score');
            table.decimal('survey_overall_score', 3, 2);
            table.string('survey_nps_bucket', 50);
            table.text('survey_comments');
            table.timestamp('survey_submission_date');
        })
        .createTable('milestones', function (table) {
            table.integer('milestone_id').primary();
            table.integer('participant_id').references('participants.participant_id');
            table.string('milestone_title', 255);
            table.date('milestone_date');
        })
        .createTable('donations', function (table) {
            table.integer('donation_id').primary();
            table.integer('participant_id').references('participants.participant_id');
            table.date('donation_date');
            table.decimal('donation_amount', 10, 2);
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
        .dropTableIfExists('event_instances')
        .dropTableIfExists('participants')
        .dropTableIfExists('event_definitions');
};

