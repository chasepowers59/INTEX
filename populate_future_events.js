const knex = require('knex')(require('./knexfile')['development']);
const { generateId } = require('./utils/idGenerator');

async function populateFutureEvents() {
    try {
        console.log('Starting population of future events...');

        // 1. Define Recurrence Patterns
        const updates = [
            { name: 'Intro to Robotics', pattern: 'Weekly', day: 1, time: '16:00' }, // Mon 4pm
            { name: 'Mariachi Practice', pattern: 'Weekly', day: 3, time: '18:00' }, // Wed 6pm
            { name: 'Leadership Summit', pattern: 'Annually', month: 10, day: 15, time: '09:00' }, // Nov 15
            { name: 'Mentorship Session', pattern: 'Monthly', week: 1, day: 4, time: '17:00' }, // 1st Thu 5pm
            { name: 'Community Service', pattern: 'Monthly', week: 3, day: 6, time: '09:00' } // 3rd Sat 9am
        ];

        // 2. Update Definitions and Generate Instances
        const definitions = await knex('event_definitions').select('*');
        const newInstances = [];

        for (const def of definitions) {
            const rule = updates.find(u => def.event_name.includes(u.name)) ||
                updates.find(u => u.name.includes(def.event_name)); // Fuzzy match

            if (rule) {
                // Update Definition
                await knex('event_definitions')
                    .where('event_definition_id', def.event_definition_id)
                    .update({ event_recurrence_pattern: rule.pattern });

                console.log(`Updated ${def.event_name} to ${rule.pattern}`);

                // Generate Instances for 2025
                let currentDate = new Date('2025-01-01');
                const endDate = new Date('2025-12-31');

                while (currentDate <= endDate) {
                    let instanceDate = null;

                    if (rule.pattern === 'Weekly') {
                        if (currentDate.getDay() === rule.day) {
                            instanceDate = new Date(currentDate);
                        }
                    } else if (rule.pattern === 'Monthly') {
                        // Simplified: Just pick the 1st of the month + offset
                        // Real logic for "3rd Saturday" is complex, simplifying to specific dates for MVP
                        if (currentDate.getDate() === 15) { // Mid-month
                            instanceDate = new Date(currentDate);
                        }
                    } else if (rule.pattern === 'Annually') {
                        if (currentDate.getMonth() === rule.month && currentDate.getDate() === rule.day) {
                            instanceDate = new Date(currentDate);
                        }
                    }

                    if (instanceDate) {
                        // Set Time
                        const [hours, minutes] = rule.time.split(':');
                        instanceDate.setHours(hours, minutes, 0, 0);

                        const end = new Date(instanceDate);
                        end.setHours(end.getHours() + 2); // 2 hour duration

                        newInstances.push({
                            event_instance_id: generateId(),
                            event_definition_id: def.event_definition_id,
                            event_date_time_start: instanceDate,
                            event_date_time_end: end,
                            event_location: 'Main Center',
                            event_capacity: def.event_default_capacity || 30
                        });
                    }

                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        }

        // 3. Insert Instances
        if (newInstances.length > 0) {
            // Batch insert to avoid limits
            const chunkSize = 50;
            for (let i = 0; i < newInstances.length; i += chunkSize) {
                await knex('event_instances').insert(newInstances.slice(i, i + chunkSize));
            }
            console.log(`Inserted ${newInstances.length} future events.`);
        } else {
            console.log('No new events generated.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

populateFutureEvents();
