// routes/profile.js
const express = require('express');
const router = express.Router();

// Middleware для проверки авторизации
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    req.flash('error', 'Пожалуйста, войдите в систему');
    res.redirect('/auth/login');
};

router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        console.log('🔍 Загрузка профиля для пользователя ID:', req.session.userId);
        
        const User = require('../models/User');
        const user = await User.findById(req.session.userId);
        
        if (!user) {
            console.log('❌ Пользователь не найден');
            req.flash('error', 'Пользователь не найден');
            return res.redirect('/auth/login');
        }
        
        console.log('✅ Профиль загружен для:', user.username);
        
        res.render('profile', {
            title: `Профиль ${user.username}`,
            user: user, // Важно! Здесь user, а не profileUser
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('❌ Ошибка загрузки профиля:', error);
        req.flash('error', 'Ошибка загрузки профиля');
        res.redirect('/');
    }
});

module.exports = router;