require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const knex = require('knex');
const knexConfig = require('./knexfile');
// const csrf = require('csurf'); // DISABLED
const flash = require('connect-flash');

const app = express();
const port = process.env.PORT || 8080;

// Database Connection
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://code.jquery.com", "https://cdnjs.cloudflare.com", "https://stackpath.bootstrapcdn.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://stackpath.bootstrapcdn.com", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            upgradeInsecureRequests: [],
        },
    },
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(flash());
// CSRF protection - must be after session and body parser
// app.use(csrf()); // DISABLED

// Global variables for views
app.use((req, res, next) => {
    // res.locals.csrfToken = req.csrfToken(); // DISABLED
    res.locals.csrfToken = 'disabled'; // Dummy token
    res.locals.messages = req.flash();
    res.locals.user = req.session.user || null;
    next();
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const mainRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const participantRoutes = require('./routes/participants');
const eventRoutes = require('./routes/events');
const milestoneRoutes = require('./routes/milestones');
const donationRoutes = require('./routes/donations');
const surveyRoutes = require('./routes/surveys');

app.use('/', mainRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/participants', participantRoutes);
app.use('/events', eventRoutes);
app.use('/milestones', milestoneRoutes);
app.use('/donations', donationRoutes);
app.use('/surveys', surveyRoutes);

// Easter Egg
app.get('/teapot', (req, res) => {
    res.status(418).send("I am a teapot - Ella Rises Code");
});

// Global Error Handler
app.use((err, req, res, next) => {
    /*
    if (err.code === 'EBADCSRFTOKEN') {
        // handle CSRF token errors here
        res.status(403);
        res.send('Form tampered with');
        return;
    }
    */
    console.error(err.stack);
    res.status(500).send('Something broke! Please try again later.');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});