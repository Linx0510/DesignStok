module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session.userId) {
            return next();
        }
        req.flash('error', 'Пожалуйста, войдите в систему');
        res.redirect('/auth/login');
    },
    
    isNotAuthenticated: (req, res, next) => {
        if (!req.session.userId) {
            return next();
        }
        res.redirect('/profile');
    }
};