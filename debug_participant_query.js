const knex = require('knex');
const knexConfig = require('./knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);

async function testFilters() {
    try {
        console.log('--- Testing Filters ---');

        // Test 1: Fetch all roles
        const roles = await db('participants').distinct('participant_role').pluck('participant_role');
        console.log('Available Roles:', roles);

        // Test 2: Filter by a specific role (if any exist)
        if (roles.length > 0 && roles[0]) {
            const testRole = roles[0];
            console.log(`\nTesting filter for role: "${testRole}"`);

            const query = db('participants').select('*');
            query.where('participant_role', 'ilike', testRole);

            console.log('SQL:', query.toString());
            const results = await query;
            console.log(`Found ${results.length} participants.`);
        }

        // Test 3: Search
        console.log('\nTesting Search "a"');
        const searchQuery = db('participants').select('*')
            .where(builder => {
                builder.where('participant_first_name', 'ilike', '%a%')
                    .orWhere('participant_last_name', 'ilike', '%a%')
                    .orWhere('participant_email', 'ilike', '%a%');
            });
        console.log('SQL:', searchQuery.toString());
        const searchResults = await searchQuery;
        console.log(`Found ${searchResults.length} participants.`);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testFilters();
