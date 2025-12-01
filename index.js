require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const knex = require('knex');
const knexConfig = require('./knexfile');

const app = express();
const port = process.env.PORT || 3000;

// Database Connection
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);

// Middleware
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const mainRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

app.use('/', mainRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Easter Egg
app.get('/teapot', (req, res) => {
    res.status(418).send("I am a teapot - Ella Rises Code");
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke! Please try again later.');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});