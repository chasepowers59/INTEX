const knex = require('knex')(require('./knexfile').development);

async function addColumns() {
    try {
        await knex.raw(`
            ALTER TABLE participant 
            ADD COLUMN IF NOT EXISTS college_status VARCHAR(50) DEFAULT 'Not Attending',
            ADD COLUMN IF NOT EXISTS degree_type VARCHAR(50) DEFAULT 'None',
            ADD COLUMN IF NOT EXISTS job_status VARCHAR(50) DEFAULT 'Student',
            ADD COLUMN IF NOT EXISTS job_field VARCHAR(50) DEFAULT 'None';
        `);
        console.log('Columns added successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error adding columns:', err);
        process.exit(1);
    }
}

addColumns();
