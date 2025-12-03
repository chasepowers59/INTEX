// const bcrypt = require('bcrypt'); // REMOVED
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const { generateId } = require('../utils/idGenerator');
const passport = require('passport');

exports.getLogin = (req, res) => {
    const error = req.flash('error')[0] || null;
    res.render('login', { user: req.user, error, messages: req.flash() });
};

exports.postLogin = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return res.render('login', { user: null, error: 'An error occurred' });
        }
        if (!user) {
            return res.render('login', { user: null, error: info.message || 'Invalid email or password' });
        }
        req.logIn(user, (err) => {
            if (err) {
                return res.render('login', { user: null, error: 'An error occurred during login' });
            }

            // Redirect based on participant_role
            if (user.participant_role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else if (user.participant_role === 'participant') {
                return res.redirect(`/participants/${user.participant_id}`);
            }
            // Fallback redirect
            return res.redirect('/');
        });
    })(req, res, next);
};

exports.getRegister = (req, res) => {
    res.render('register', { user: req.user, error: null, messages: req.flash() });
};

exports.postRegister = async (req, res) => {
    const { participant_first_name, participant_last_name, participant_email, participant_password, confirm_password } = req.body;

    try {
        // Validate passwords match
        if (participant_password !== confirm_password) {
            return res.render('register', { user: null, error: 'Passwords do not match' });
        }

        // Check if email already exists
        const existing = await db('participants').where({ participant_email }).first();
        if (existing) {
            return res.render('register', { user: null, error: 'Email already registered' });
        }

        // Hash password
        // const hashedPassword = await bcrypt.hash(participant_password, 10); // REMOVED

        // Generate participant ID
        const participantId = generateId();

        // Insert into participants table
        await db('participants').insert({
            participant_id: participantId,
            participant_first_name,
            participant_last_name,
            participant_email,
            participant_password: participant_password, // Plain text
            participant_role: 'participant' // Hardcoded to 'participant'
        });

        req.flash('success', 'Registration successful! Please login.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.render('register', { user: null, error: 'An error occurred during registration' });
    }
};

exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
};
