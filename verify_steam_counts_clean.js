const knex = require('./knexfile')[process.env.NODE_ENV || 'development'];
const db = require('knex')(knex);

async function verifySteamCounts() {
    try {
        const educationKeywords = ['Education', 'College', 'University', 'Degree', 'Graduation', 'School', 'FAFSA', 'Scholarship', 'Enrolled', 'Accepted', 'Admission'];
        const jobKeywords = ['Job', 'Career', 'Employment', 'Hired', 'Position', 'Work', 'Internship', 'Employed'];
        const steamKeywords = ['Engineering', 'Science', 'Math', 'Technology', 'Medical', 'Nursing', 'Biology', 'CS', 'Computer', 'STEM', 'STEAM', 'Chemistry', 'Physics', 'Data', 'Software', 'Developer', 'Programmer'];

        const educationCondition = educationKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');
        const jobCondition = jobKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');
        const steamCondition = steamKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');

        const steamEducationCount = await db('milestones')
            .whereRaw(`(${educationCondition}) AND (${steamCondition})`)
            .count('milestone_id as count')
            .first();

        const steamJobCount = await db('milestones')
            .whereRaw(`(${jobCondition}) AND (${steamCondition})`)
            .count('milestone_id as count')
            .first();

        const totalEducationCount = await db('milestones')
            .whereRaw(`(${educationCondition})`)
            .count('milestone_id as count')
            .first();

        const totalJobCount = await db('milestones')
            .whereRaw(`(${jobCondition})`)
            .count('milestone_id as count')
            .first();

        const fs = require('fs');
        const output = `
STEAM Education Count: ${steamEducationCount.count}
Total Education Count: ${totalEducationCount.count}
STEAM Job Count:       ${steamJobCount.count}
Total Job Count:       ${totalJobCount.count}
        `;
        fs.writeFileSync('counts.txt', output);
        console.log('Counts written to counts.txt');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifySteamCounts();
