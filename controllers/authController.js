// const bcrypt = require('bcrypt'); // REMOVED
const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
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

            // Redirect all users to root page after login
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
        const existing = await knex('participants').where({ participant_email }).first();
        
        if (existing) {
            // If participant exists but has no password (created from visitor registration/donation)
            // Update the existing record with the password to complete account creation
            if (!existing.participant_password) {
                await knex('participants')
                    .where({ participant_id: existing.participant_id })
                    .update({
                        participant_first_name: participant_first_name || existing.participant_first_name,
                        participant_last_name: participant_last_name || existing.participant_last_name,
                        participant_password: participant_password, // Plain text
                        participant_role: existing.participant_role || 'participant'
                    });
                
                req.flash('success', 'Account created successfully! You can now login with your email and password.');
                return res.redirect('/auth/login');
            } else {
                // Participant exists and already has a password - account already exists
                return res.render('register', { user: null, error: 'Email already registered. Please login instead.' });
            }
        }

        // Hash password
        // const hashedPassword = await bcrypt.hash(participant_password, 10); // REMOVED

        // Generate participant ID
        const participantId = generateId();

        // Insert into participants table
        // Business Logic: All new user registrations default to 'participant' role
        // Only admins can change roles through the User Maintenance interface
        await knex('participants').insert({
            participant_id: participantId,
            participant_first_name,
            participant_last_name,
            participant_email,
            participant_password: participant_password, // Plain text
            participant_role: 'participant' // Hardcoded to 'participant' - never 'admin' for new registrations
        });

        req.flash('success', 'Registration successful! Please login.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error('Post Register Error:', err);
        req.flash('error', 'An error occurred during registration. Please try again.');
        res.render('register', { user: null, error: 'An error occurred during registration', messages: req.flash() });
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
