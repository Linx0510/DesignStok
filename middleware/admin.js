const User = require('../models/User');

module.exports = async (req, res, next) => {
    if (!req.session.userId) {
        req.flash('error', 'Доступ запрещен');
        return res.redirect('/login');
    }
    
    const user = await User.findById(req.session.userId);
    if (user && user.role === 'admin') {
        return next();
    }
    
    req.flash('error', 'Доступ запрещен');
    res.redirect('/');
};