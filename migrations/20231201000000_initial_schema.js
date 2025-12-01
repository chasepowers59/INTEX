/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('app_user', function (table) {
            table.increments('user_id').primary();
            table.string('username').notNullable().unique();
            table.string('password_hash').notNullable();
            table.enum('role', ['Manager', 'Common']).notNullable().defaultTo('Common');
        })
        .createTable('participant', function (table) {
            table.increments('participant_id').primary();
            table.string('email').notNullable().unique();
            table.string('first_name').notNullable();
            table.string('last_name').notNullable();
            table.enum('generation_status', ['1st', '2nd', '3rd']).notNullable();
            table.string('household_income_bracket');
            table.string('phone');
        })
        .createTable('event_template', function (table) {
            table.increments('template_id').primary();
            table.string('event_name').notNullable();
            table.enum('event_type', ['STEAM', 'Mariachi', 'Leadership']).notNullable();
            table.text('description');
        })
        .createTable('event_occurrence', function (table) {
            table.increments('occurrence_id').primary();
            table.integer('template_id').unsigned().notNullable();
            table.foreign('template_id').references('event_template.template_id').onDelete('CASCADE');
            table.dateTime('start_time').notNullable();
            table.dateTime('end_time').notNullable();
            table.string('location');
        })
        .createTable('registration', function (table) {
            table.increments('registration_id').primary();
            table.integer('participant_id').unsigned().notNullable();
            table.foreign('participant_id').references('participant.participant_id').onDelete('CASCADE');
            table.integer('occurrence_id').unsigned().notNullable();
            table.foreign('occurrence_id').references('event_occurrence.occurrence_id').onDelete('CASCADE');
            table.unique(['participant_id', 'occurrence_id']);
        })
        .createTable('survey', function (table) {
            table.increments('survey_id').primary();
            table.integer('registration_id').unsigned().notNullable();
            table.foreign('registration_id').references('registration.registration_id').onDelete('CASCADE');
            table.integer('satisfaction_score');
            table.integer('self_confidence_rating');
            table.text('comments');
        })
        .createTable('milestone', function (table) {
            table.increments('milestone_id').primary();
            table.integer('participant_id').unsigned().notNullable();
            table.foreign('participant_id').references('participant.participant_id').onDelete('CASCADE');
            table.string('title').notNullable();
            table.date('date_achieved');
        })
        .createTable('donation', function (table) {
            table.increments('donation_id').primary();
            table.integer('participant_id').unsigned(); // Can be null if donation is not linked to a participant? Assuming linked for now based on prompt "participant_id"
            table.foreign('participant_id').references('participant.participant_id').onDelete('SET NULL');
            table.decimal('amount', 14, 2).notNullable();
            table.date('date').notNullable();
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('donation')
        .dropTableIfExists('milestone')
        .dropTableIfExists('survey')
        .dropTableIfExists('registration')
        .dropTableIfExists('event_occurrence')
        .dropTableIfExists('event_template')
        .dropTableIfExists('participant')
        .dropTableIfExists('app_user');
};
