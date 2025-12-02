const { Client } = require('pg');

const client = new Client({
    host: process.env.RDS_HOSTNAME || 'localhost',
    user: 'ella_admin',
    password: 'ella_password',
    database: 'ella_rises',
    port: 5434,
});

async function addPhotoColumn() {
    try {
        await client.connect();
        console.log('Connected to database.');

        await client.query(`
            ALTER TABLE participant 
            ADD COLUMN photo_url VARCHAR(255);
        `);
        console.log('Added photo_url column to participant table.');

        await client.end();
    } catch (err) {
        // Ignore if column already exists
        if (err.code === '42701') {
            console.log('Column photo_url already exists.');
        } else {
            console.error('Error updating schema:', err);
        }
        process.exit(0);
    }
}

addPhotoColumn();
