require('dotenv').config();

module.exports = {
    development: {
        client: 'pg',
        connection: {
            host: process.env.RDS_HOSTNAME || 'localhost',
            user: process.env.RDS_USERNAME || 'ella_admin',
            password: process.env.RDS_PASSWORD || 'ella_password',
            database: process.env.RDS_DB_NAME || 'ella_rises',
            port: 5434,
        },
        migrations: {
            directory: './migrations'
        },
        seeds: {
            directory: './seeds'
        }
    },

    production: {
        client: 'pg',
        connection: {
            host: process.env.RDS_HOSTNAME || process.env.DB_HOSTNAME,
            user: process.env.RDS_USERNAME || process.env.DB_USERNAME,
            password: process.env.RDS_PASSWORD || process.env.DB_PASSWORD,
            database: process.env.RDS_DB_NAME || process.env.DB_NAME,
            port: process.env.RDS_PORT || 5432,
            ssl: { rejectUnauthorized: false }
        },
        migrations: {
            directory: './migrations'
        },
        seeds: {
            directory: './seeds'
        }
    }
};
