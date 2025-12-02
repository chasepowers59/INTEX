const bcrypt = require('bcrypt');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);

exports.getLogin = (req, res) => {
    res.render('login', { user: req.session.user, error: null });
};

exports.postLogin = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db('app_user').where({ username }).first();

        // Check for plain text password OR bcrypt hash
        const isMatch = user && (user.password_hash === password || await bcrypt.compare(password, user.password_hash));

        if (isMatch) {
            req.session.user = user;
            return res.redirect('/admin/dashboard');
        }

        res.render('login', { user: null, error: 'Invalid username or password' });
    } catch (err) {
        console.error(err);
        res.render('login', { user: null, error: 'An error occurred' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
};
