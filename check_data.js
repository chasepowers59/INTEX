const knex = require('knex')(require('./knexfile')['development']);

async function checkData() {
    try {
        const count = await knex('event_instances').count('event_instance_id as count').first();
        console.log('Event Count:', count.count);

        const events = await knex('event_instances').select('*');
        console.log('Events:', events);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
