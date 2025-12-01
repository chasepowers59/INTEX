require('dotenv').config();

module.exports = {
    development: {
        client: 'pg',
        connection: {
            host: process.env.RDS_HOSTNAME || 'localhost',
            user: process.env.RDS_USERNAME || 'postgres',
            password: process.env.RDS_PASSWORD || 'lauren1186',
            database: process.env.RDS_DB_NAME || 'ella_rises',
            port: process.env.RDS_PORT || 5432,
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
            host: process.env.RDS_HOSTNAME,
            user: process.env.RDS_USERNAME,
            password: process.env.RDS_PASSWORD,
            database: process.env.RDS_DB_NAME,
            port: process.env.RDS_PORT,
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
