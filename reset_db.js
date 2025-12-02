const knex = require('knex')(require('./knexfile').development);

async function reset() {
    try {
        // Drop new tables
        await knex.schema.dropTableIfExists('Donations');
        await knex.schema.dropTableIfExists('Milestones');
        await knex.schema.dropTableIfExists('Surveys');
        await knex.schema.dropTableIfExists('Registrations');
        await knex.schema.dropTableIfExists('EventInstance');
        await knex.schema.dropTableIfExists('EventDefinition');
        await knex.schema.dropTableIfExists('Participants');

        // Drop old tables
        await knex.schema.dropTableIfExists('donation');
        await knex.schema.dropTableIfExists('milestone');
        await knex.schema.dropTableIfExists('survey');
        await knex.schema.dropTableIfExists('registration');
        await knex.schema.dropTableIfExists('event_occurrence');
        await knex.schema.dropTableIfExists('event_template');
        await knex.schema.dropTableIfExists('participant');

        // Drop user table
        await knex.schema.dropTableIfExists('app_user');

        console.log('Tables dropped.');
        process.exit(0);
    } catch (err) {
        console.error('Error resetting DB:', err);
        process.exit(1);
    }
}

reset();
