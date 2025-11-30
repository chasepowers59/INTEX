require('dotenv').config(); 
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Database Configuration
// Elastic Beanstalk provides these specific RDS_ variables automatically
const pool = new Pool({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB_NAME,
  port: process.env.RDS_PORT,
  ssl: { rejectUnauthorized: false }
});

// 1. Health Check Endpoint
app.get('/', (req, res) => {
  res.send('Hello! The API is running with a Coupled Database.');
});

// 2. Database Connection Test
app.get('/db-test', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    res.json({ 
      status: 'Database connected successfully!', 
      server_time: result.rows[0].time 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});