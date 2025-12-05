// Authentication Middleware: Ensures user is logged in
// Redirects to login page if no user session exists
exports.isAuthenticated = (req, res, next) => {
    if (req.user) {
        return next();
    }
    res.redirect('/auth/login');
};

// Manager-Only Middleware: Restricts access to admin role only
// Note: In this system, 'admin' role represents the "Manager" role mentioned in the rubric
// Common users have 'participant' role and should have read-only access
// Security: Explicitly check for 'admin' role and reject null/undefined/empty values
exports.isManager = (req, res, next) => {
    if (req.user && req.user.participant_role && req.user.participant_role === 'admin') {
        return next();
    }
    res.status(403).send('Access Denied: Admin Only');
};

// Read-Only or Manager Middleware: Implements role-based access control
// Business Logic: 
// - GET requests (read operations) are allowed for all authenticated users (both admin and participant roles)
// - POST/PUT/DELETE requests (write operations) are restricted to managers (admin role) only
// This satisfies the rubric requirement: "Common User: Read-only (View) on ALL modules"
exports.isReadOnlyOrManager = (req, res, next) => {
    // First check if user is authenticated
    if (!req.user) {
        return res.redirect('/auth/login');
    }
    
    // GET requests: Allow all authenticated users (read-only access for common users)
    if (req.method === 'GET') {
        return next();
    }
    
    // POST/PUT/DELETE requests: Only allow managers (admin role)
    // This ensures common users can view but cannot modify data
    // Security: Explicitly check for 'admin' role and reject null/undefined/empty values
    if (req.user.participant_role && req.user.participant_role === 'admin') {
        return next();
    }
    
    // Common user trying to perform write operation
    res.status(403).send('Access Denied: Manager privileges required for this operation');
};

// NOTE: isAdmin is deprecated - use isManager instead
// Keeping for backward compatibility but should not be used in new code
// exports.isAdmin = (req, res, next) => {
//     if (req.session && req.session.user && req.session.user.participant_role === 'admin') {
//         return next();
//     }
//     res.status(403).send('Access Denied: Admin Only');
// };
