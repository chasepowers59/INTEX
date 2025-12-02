const knex = require('knex')(require('./knexfile').development);

async function check() {
    try {
        const hasTable = await knex.schema.hasTable('participant');
        console.log('Has participant table:', hasTable);
        if (hasTable) {
            const columns = await knex('participant').columnInfo();
            console.log('Columns:', Object.keys(columns));
        }
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
