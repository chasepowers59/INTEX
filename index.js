require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const knex = require('knex');
const knexConfig = require('./knexfile');
// const csrf = require('csurf'); // DISABLED
const flash = require('connect-flash');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Elastic Beanstalk Load Balancer)
const port = process.env.PORT || 3000;

// Database Connection
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);

const store = new KnexSessionStore({
    knex: db,
    tablename: 'sessions',
    createtable: true,
    clearInterval: 1000 * 60 * 60 // Clear expired sessions every hour
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://code.jquery.com", "https://cdnjs.cloudflare.com", "https://stackpath.bootstrapcdn.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://stackpath.bootstrapcdn.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
            upgradeInsecureRequests: [],
        },
    },
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    store: store,
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // SSL terminated at Load Balancer/Nginx
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.use(flash());

// Initialize Passport
const passport = require('./config/passport-config');
app.use(passport.initialize());
app.use(passport.session());

// CSRF protection - must be after session and body parser
// app.use(csrf()); // DISABLED

// Global variables for views
app.use((req, res, next) => {
    // res.locals.csrfToken = req.csrfToken(); // DISABLED
    res.locals.csrfToken = 'disabled'; // Dummy token
    res.locals.messages = req.flash();
    // Use Passport's req.user and add role alias for backward compatibility
    if (req.user) {
        // Map participant_role to role for views that use the old property name
        // 'admin' maps to 'Manager', 'participant' maps to 'participant'
        req.user.role = req.user.participant_role === 'admin' ? 'Manager' : (req.user.participant_role || 'participant');
    }
    res.locals.user = req.user || null;
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

// Easter Egg - RFC 2324
app.get('/teapot', (req, res) => {
    res.status(418).render('teapot');
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