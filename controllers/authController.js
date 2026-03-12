const User = require('../models/User');
const { body, validationResult } = require('express-validator');

exports.getLogin = (req, res) => {
    res.render('login', { 
        title: 'Вход',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

exports.getRegister = (req, res) => {
    res.render('register', { 
        title: 'Регистрация',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

exports.postLogin = async (req, res) => {
    try {
        console.log('📝 Попытка входа:', req.body.email);
        
        const { email, password } = req.body;
        
        // Проверка на пустые поля
        if (!email || !password) {
            console.log('❌ Не заполнены поля');
            req.flash('error', 'Заполните все поля');
            return res.redirect('/auth/login');
        }
        
        const User = require('../models/User');
        
        // Поиск пользователя по email
        const user = await User.findByEmail(email);
        console.log('🔍 Результат поиска пользователя:', user ? 'Найден' : 'Не найден');
        
        if (!user) {
            req.flash('error', 'Пользователь с таким email не найден');
            return res.redirect('/auth/login');
        }
        
        // Проверка пароля
        const isValid = await User.comparePassword(password, user.password_hash);
        console.log('🔑 Проверка пароля:', isValid ? 'Успешно' : 'Неверный');
        
        if (!isValid) {
            req.flash('error', 'Неверный пароль');
            return res.redirect('/auth/login');
        }
        
        // Сохраняем пользователя в сессии
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        console.log('✅ Успешный вход для пользователя:', user.id);
        
        req.flash('success', 'Добро пожаловать!');
        res.redirect('/profile');
    } catch (error) {
        console.error('❌ Ошибка при входе:', error);
        req.flash('error', 'Произошла ошибка при входе: ' + error.message);
        res.redirect('/auth/login');
    }
};

exports.postRegister = async (req, res) => {
    try {
        console.log('📝 Регистрация нового пользователя:', req.body.email);
        
        const { username, email, password, confirmPassword } = req.body;
        
        // Валидация
        const errors = [];
        if (password !== confirmPassword) {
            errors.push('Пароли не совпадают');
        }
        if (password.length < 6) {
            errors.push('Пароль должен содержать минимум 6 символов');
        }
        
        if (errors.length > 0) {
            req.flash('error', errors.join(', '));
            return res.redirect('/auth/register');
        }
        
        const User = require('../models/User');
        
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            req.flash('error', 'Пользователь с таким email уже существует');
             return res.redirect('/auth/register');
        }
        
        const user = await User.create(username, email, password);
        console.log('✅ Пользователь создан:', user.id);
        
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        req.flash('success', 'Регистрация прошла успешно!');
        res.redirect('/profile');
    } catch (error) {
        console.error('❌ Ошибка при регистрации:', error);
        req.flash('error', 'Произошла ошибка при регистрации: ' + error.message);
         return res.redirect('/auth/register');
    }
};
exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/');
};