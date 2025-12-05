const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

/**
 * Passport Local Strategy Configuration
 * 
 * Business Logic: Handles user authentication by comparing provided credentials
 * with stored user data. Passwords are stored as plain text.
 * 
 * Authentication Flow:
 * 1. Look up user by email
 * 2. Compare password using direct string comparison
 * 3. Return user object if credentials match, otherwise return false
 */
passport.use(new LocalStrategy({
    usernameField: 'participant_email',
    passwordField: 'participant_password'
}, async (participant_email, participant_password, done) => {
    try {
        console.log(`Looking up email: ${participant_email}`);
        const user = await knex('participants').where({ participant_email }).first();
        console.log('User Found?', user ? 'YES' : 'NO');

        if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
        }

        // Password Comparison Logic
        // Direct string comparison for plain text passwords
        const isMatch = user.participant_password === participant_password;

        console.log('Password match result?', isMatch);

        if (isMatch) {
            return done(null, user);
        } else {
            return done(null, false, { message: 'Invalid email or password' });
        }
    } catch (err) {
        console.error('Passport authentication error:', err);
        return done(err);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.participant_id);
});

// Deserialize user from session
passport.deserializeUser(async (participant_id, done) => {
    try {
        const user = await knex('participants').where({ participant_id }).first();
        done(null, user);
    } catch (err) {
        console.error('Passport deserialize error:', err);
        done(err);
    }
});

module.exports = passport;

