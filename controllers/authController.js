const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);
const bcrypt = require('bcrypt');

exports.getLogin = (req, res) => {
    res.render('login', { user: req.session.user, error: null });
};

exports.postLogin = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await knex('app_user').where({ username }).first();

        if (user && await bcrypt.compare(password, user.password_hash)) {
            req.session.user = {
                user_id: user.user_id,
                username: user.username,
                role: user.role
            };
            res.redirect('/admin/dashboard');
        } else {
            res.render('login', { user: null, error: 'Invalid username or password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
};
