exports.isAuthenticated = (req, res, next) => {
    if (req.user) {
        return next();
    }
    res.redirect('/auth/login');
};

exports.isManager = (req, res, next) => {
    if (req.user && req.user.participant_role === 'admin') {
        return next();
    }
    res.status(403).send('Access Denied: Admin Only');
};

exports.isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.participant_role === 'admin') {
        return next();
    }
    res.status(403).send('Access Denied: Admin Only');
};
