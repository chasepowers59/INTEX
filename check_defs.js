const knex = require('knex')(require('./knexfile')['development']);

async function checkDefinitions() {
    try {
        const defs = await knex('event_definitions').select('event_name', 'event_recurrence_pattern');
        console.log(JSON.stringify(defs, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDefinitions();
