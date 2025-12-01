exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
};

exports.isManager = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'Manager') {
        return next();
    }
    res.status(403).send('Access Denied: Managers Only');
};
