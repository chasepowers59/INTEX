const { Client } = require('pg');

const client = new Client({
    host: process.env.RDS_HOSTNAME || 'localhost',
    user: 'ella_admin',
    password: 'ella_password',
    database: 'ella_rises',
    port: 5434, // User said they changed port to 5434
});

console.log('Attempting to connect...');

client.connect()
    .then(() => {
        console.log('Connected successfully!');
        return client.end();
    })
    .catch(err => {
        console.error('Connection failed:', err);
    });
