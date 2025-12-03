const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const knex = require('knex');
const knexConfig = require('../knexfile');

const db = knex(knexConfig[process.env.NODE_ENV || 'development']);

// Configure LocalStrategy
passport.use(new LocalStrategy({
    usernameField: 'participant_email',
    passwordField: 'participant_password'
}, async (participant_email, participant_password, done) => {
    try {
        console.log(`Looking up email: ${participant_email}`);
        const user = await db('participants').where({ participant_email }).first();
        console.log('User Found?', user ? 'YES' : 'NO');
        
        if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
        }
        
        if (user) console.log('Stored hash:', user.participant_password);
        
        // Check for plain text password OR bcrypt hash
        const isMatch = user.participant_password === participant_password || 
                       await bcrypt.compare(participant_password, user.participant_password);
        console.log('Hash comparison result?', isMatch);
        
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
        const user = await db('participants').where({ participant_id }).first();
        done(null, user);
    } catch (err) {
        console.error('Passport deserialize error:', err);
        done(err);
    }
});

module.exports = passport;

