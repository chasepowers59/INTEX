const knex = require('knex')(require('./knexfile')[process.env.NODE_ENV || 'development']);
const { generateId } = require('./utils/idGenerator');

/**
 * Populate Future Events Based on Recurrence Patterns
 * 
 * This script reads event_definitions from the database and generates
 * future event_instances based on their event_recurrence_pattern.
 * 
 * Patterns supported:
 * - Weekly: Generates events every week on a specific day
 * - Monthly: Generates events on a specific day of each month
 * - Annual: Generates events once per year on a specific date
 */

// Helper function to determine day of week from event name
function getDayOfWeekFromName(eventName) {
    const name = eventName.toLowerCase();
    if (name.includes('saturday') || name.includes('sat')) return 6;
    if (name.includes('sunday') || name.includes('sun')) return 0;
    if (name.includes('monday') || name.includes('mon')) return 1;
    if (name.includes('tuesday') || name.includes('tue')) return 2;
    if (name.includes('wednesday') || name.includes('wed')) return 3;
    if (name.includes('thursday') || name.includes('thu')) return 4;
    if (name.includes('friday') || name.includes('fri')) return 5;
    // Default to Monday for weekly events
    return 1;
}

// Helper function to determine time from event name
function getTimeFromName(eventName) {
    const name = eventName.toLowerCase();
    if (name.includes('night') || name.includes('evening')) return '18:00';
    if (name.includes('morning')) return '09:00';
    if (name.includes('afternoon')) return '14:00';
    // Default times based on event type
    if (name.includes('office hours')) return '14:00';
    if (name.includes('lab') || name.includes('workshop')) return '16:00';
    if (name.includes('summit') || name.includes('conference')) return '09:00';
    // Default to 2pm
    return '14:00';
}

// Helper function to get month/day for annual events
function getAnnualDateFromName(eventName) {
    const name = eventName.toLowerCase();
    // Default to June 15th for annual events
    if (name.includes('leadership')) return { month: 5, day: 15 }; // June
    if (name.includes('summit') || name.includes('expo')) return { month: 7, day: 1 }; // August
    if (name.includes('showcase')) return { month: 9, day: 15 }; // October
    return { month: 5, day: 15 }; // Default to June 15
}

// Helper function to get day of month for monthly events
function getMonthlyDayFromName(eventName) {
    const name = eventName.toLowerCase();
    // Default to 15th of month for monthly events
    if (name.includes('first') || name.includes('1st')) return 1;
    if (name.includes('second') || name.includes('2nd')) return 8;
    if (name.includes('third') || name.includes('3rd')) return 15;
    if (name.includes('fourth') || name.includes('4th') || name.includes('last')) return 22;
    // Default to 15th
    return 15;
}

async function populateFutureEvents() {
    try {
        console.log('Starting population of future events...');

        // Configuration: Date range for generating events
        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-12-31');
        console.log(`Generating events from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        // Get all event definitions with recurrence patterns
        const definitions = await knex('event_definitions')
            .whereNotNull('event_recurrence_pattern')
            .where('event_recurrence_pattern', '!=', '')
            .whereNotNull('event_name')
            .select('*');

        console.log(`Found ${definitions.length} event definitions with recurrence patterns`);

        if (definitions.length === 0) {
            console.log('No event definitions with recurrence patterns found.');
            process.exit(0);
        }

        // Get existing instances to avoid duplicates
        const existingInstances = await knex('event_instances')
            .whereBetween('event_date_time_start', [startDate, endDate])
            .select('event_definition_id', 'event_date_time_start');

        const existingKeys = new Set(
            existingInstances.map(inst => 
                `${inst.event_definition_id}-${inst.event_date_time_start.toISOString().split('T')[0]}`
            )
        );

        const newInstances = [];

        for (const def of definitions) {
            const pattern = def.event_recurrence_pattern;
            console.log(`\nProcessing: ${def.event_name} (${pattern})`);

            let instanceCount = 0;

            if (pattern === 'Weekly') {
                const dayOfWeek = getDayOfWeekFromName(def.event_name);
                const time = getTimeFromName(def.event_name);
                const [hours, minutes] = time.split(':');

                let currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    if (currentDate.getDay() === dayOfWeek) {
                        const instanceDate = new Date(currentDate);
                        instanceDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                        const key = `${def.event_definition_id}-${instanceDate.toISOString().split('T')[0]}`;
                        if (!existingKeys.has(key)) {
                            const endTime = new Date(instanceDate);
                            endTime.setHours(endTime.getHours() + 2); // 2 hour default duration

                            newInstances.push({
                                event_instance_id: generateId(),
                                event_definition_id: def.event_definition_id,
                                event_date_time_start: instanceDate,
                                event_date_time_end: endTime,
                                event_location: 'Main Center',
                                event_capacity: def.event_default_capacity || 30
                            });
                            instanceCount++;
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }

            } else if (pattern === 'Monthly') {
                const dayOfMonth = getMonthlyDayFromName(def.event_name);
                const time = getTimeFromName(def.event_name);
                const [hours, minutes] = time.split(':');

                let currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    // Check if this is the target day of month
                    if (currentDate.getDate() === dayOfMonth) {
                        const instanceDate = new Date(currentDate);
                        instanceDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                        const key = `${def.event_definition_id}-${instanceDate.toISOString().split('T')[0]}`;
                        if (!existingKeys.has(key)) {
                            const endTime = new Date(instanceDate);
                            endTime.setHours(endTime.getHours() + 3); // 3 hour default for monthly events

                            newInstances.push({
                                event_instance_id: generateId(),
                                event_definition_id: def.event_definition_id,
                                event_date_time_start: instanceDate,
                                event_date_time_end: endTime,
                                event_location: 'Main Center',
                                event_capacity: def.event_default_capacity || 30
                            });
                            instanceCount++;
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }

            } else if (pattern === 'Annual' || pattern === 'Annually') {
                const annualDate = getAnnualDateFromName(def.event_name);
                const time = getTimeFromName(def.event_name);
                const [hours, minutes] = time.split(':');

                // Generate for each year in the range
                let currentYear = startDate.getFullYear();
                const endYear = endDate.getFullYear();

                for (let year = currentYear; year <= endYear; year++) {
                    const instanceDate = new Date(year, annualDate.month, annualDate.day);
                    instanceDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                    // Only generate if within date range
                    if (instanceDate >= startDate && instanceDate <= endDate) {
                        const key = `${def.event_definition_id}-${instanceDate.toISOString().split('T')[0]}`;
                        if (!existingKeys.has(key)) {
                            const endTime = new Date(instanceDate);
                            endTime.setHours(endTime.getHours() + 8); // 8 hour default for annual events

                            newInstances.push({
                                event_instance_id: generateId(),
                                event_definition_id: def.event_definition_id,
                                event_date_time_start: instanceDate,
                                event_date_time_end: endTime,
                                event_location: 'Main Center',
                                event_capacity: def.event_default_capacity || 30
                            });
                            instanceCount++;
                        }
                    }
                }
            } else {
                console.log(`  ⚠️  Unknown pattern: ${pattern} - skipping`);
                continue;
            }

            console.log(`  ✓ Generated ${instanceCount} instances`);
        }

        // Insert new instances in batches
        if (newInstances.length > 0) {
            console.log(`\nInserting ${newInstances.length} new event instances...`);
            const chunkSize = 50;
            for (let i = 0; i < newInstances.length; i += chunkSize) {
                await knex('event_instances').insert(newInstances.slice(i, i + chunkSize));
                console.log(`  Inserted batch ${Math.floor(i / chunkSize) + 1} (${Math.min(i + chunkSize, newInstances.length)}/${newInstances.length})`);
            }
            console.log(`\n✅ Successfully inserted ${newInstances.length} future events.`);
        } else {
            console.log('\n⚠️  No new events generated (all may already exist).');
        }

        await knex.destroy();
        process.exit(0);
    } catch (err) {
        console.error('Error populating future events:', err);
        await knex.destroy();
        process.exit(1);
    }
}

populateFutureEvents();
