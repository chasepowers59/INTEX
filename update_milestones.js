const knex = require('./knexfile')[process.env.NODE_ENV || 'development'];
const db = require('knex')(knex);

async function updateMilestones() {
    try {
        // Update some Education milestones to be STEAM
        const educationKeywords = ['Education', 'College', 'University', 'Degree', 'Graduation', 'School', 'FAFSA', 'Scholarship', 'Enrolled', 'Accepted', 'Admission'];
        const educationCondition = educationKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');

        const educationMilestones = await db('milestones')
            .whereRaw(`(${educationCondition})`)
            .select('milestone_id');

        console.log(`Found ${educationMilestones.length} education milestones.`);

        // Update 30% of them
        const steamEducationTitles = [
            'BS in Computer Science',
            'Accepted to Engineering Program',
            'Scholarship for STEM',
            'Graduated with Biology Degree',
            'Enrolled in Data Science'
        ];

        let updatedEdCount = 0;
        for (let i = 0; i < educationMilestones.length; i++) {
            if (Math.random() < 0.3) {
                const title = steamEducationTitles[Math.floor(Math.random() * steamEducationTitles.length)];
                await db('milestones')
                    .where('milestone_id', educationMilestones[i].milestone_id)
                    .update({ milestone_title: title });
                updatedEdCount++;
            }
        }
        console.log(`Updated ${updatedEdCount} education milestones to STEAM.`);

        // Update some Job milestones to be STEAM
        const jobKeywords = ['Job', 'Career', 'Employment', 'Hired', 'Position', 'Work', 'Internship', 'Employed'];
        const jobCondition = jobKeywords.map(k => `milestone_title ILIKE '%${k}%'`).join(' OR ');

        const jobMilestones = await db('milestones')
            .whereRaw(`(${jobCondition})`)
            .select('milestone_id');

        console.log(`Found ${jobMilestones.length} job milestones.`);

        // Update 30% of them
        const steamJobTitles = [
            'Hired as Software Developer',
            'Internship at Tech Company',
            'Data Analyst Position',
            'Engineering Job',
            'Career in Medical Field'
        ];

        let updatedJobCount = 0;
        for (let i = 0; i < jobMilestones.length; i++) {
            if (Math.random() < 0.3) {
                const title = steamJobTitles[Math.floor(Math.random() * steamJobTitles.length)];
                await db('milestones')
                    .where('milestone_id', jobMilestones[i].milestone_id)
                    .update({ milestone_title: title });
                updatedJobCount++;
            }
        }
        console.log(`Updated ${updatedJobCount} job milestones to STEAM.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateMilestones();
