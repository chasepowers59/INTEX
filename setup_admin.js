const knex = require('knex')(require('./knexfile')[process.env.NODE_ENV || 'development']);

async function setupAdmin() {
    try {
        console.log('Setting up admin user...');

        // Update Isabella Hernandez (PART-004) to be an Admin with password 'password'
        const email = 'isa.h@example.com';
        const password = 'password';

        const count = await knex('participants')
            .where({ participant_email: email })
            .update({
                participant_role: 'admin',
                participant_password: password
            });

        if (count > 0) {
            console.log(`Successfully updated ${email} to Admin with password '${password}'`);
        } else {
            console.log(`User ${email} not found. Creating new admin...`);
            // Create if not exists
            await knex('participants').insert({
                participant_id: 9999, // Use integer ID
                participant_first_name: 'Admin',
                participant_last_name: 'User',
                participant_email: 'admin@ellarises.com',
                participant_password: 'password',
                participant_role: 'admin',
                participant_city: 'Provo',
                participant_dob: '1980-01-01'
            });
            console.log('Created new admin: admin@ellarises.com / password');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error setting up admin:', err);
        process.exit(1);
    }
}

setupAdmin();
