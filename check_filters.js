const knex = require('knex');
const knexConfig = require('./knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);

async function checkData() {
    try {
        const roles = await db('participants').distinct('participant_role').pluck('participant_role');
        const cities = await db('participants').distinct('participant_city').pluck('participant_city');
        console.log('Roles:', roles);
        console.log('Cities:', cities);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
