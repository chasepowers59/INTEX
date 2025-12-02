const knex = require('knex')(require('./knexfile')['development']);

async function checkState() {
    try {
        const hasDonations = await knex.schema.hasTable('donations');
        console.log('Has donations table:', hasDonations);

        if (hasDonations) {
            const columnInfo = await knex('donations').columnInfo('participant_id');
            console.log('Donations participant_id info:', columnInfo);
        }

        const hasTemplates = await knex.schema.hasTable('milestone_templates');
        console.log('Has milestone_templates table:', hasTemplates);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkState();
