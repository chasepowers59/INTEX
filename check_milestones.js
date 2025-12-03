const knex = require('./knexfile')[process.env.NODE_ENV || 'development'];
const db = require('knex')(knex);

async function checkMilestones() {
    try {
        const milestones = await db('milestones').select('milestone_title');
        console.log('Total Milestones:', milestones.length);
        console.log('Milestone Titles:', milestones.map(m => m.milestone_title));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkMilestones();
