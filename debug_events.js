const knex = require('knex')(require('./knexfile')['development']);

async function debugEvents() {
    try {
        console.log('Server Time:', new Date());

        const count = await knex('event_instances').count('event_instance_id as count').first();
        console.log('Total Events in DB:', count.count);

        const futureEvents = await knex('event_instances')
            .where('event_date_time_start', '>=', new Date())
            .count('event_instance_id as count')
            .first();
        console.log('Future Events (>= Now):', futureEvents.count);

        const sample = await knex('event_instances')
            .select('event_date_time_start')
            .orderBy('event_date_time_start', 'desc')
            .limit(5);
        console.log('Sample Event Dates:', sample);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugEvents();
