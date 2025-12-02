module.exports = {
    apps: [{
        name: "ella-rises-capstone",
        script: "./index.js",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: "development",
        },
        env_production: {
            NODE_ENV: "production",
            PORT: 3000,
            // RDS variables will be set in the EC2 environment or here
            RDS_HOSTNAME: "ella-rises-db.cdss2o4m8yje.us-east-2.rds.amazonaws.com",
            RDS_USERNAME: "postgres",
            RDS_PASSWORD: "BestGroup#123",
            RDS_DB_NAME: "ebdb", // Verify this name
            RDS_PORT: 5432
        }
    }]
};
