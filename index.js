const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));

// Flash messages
app.use(flash());

// Make user available to all templates
app.use(async (req, res, next) => {
    res.locals.currentUser = null;
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    
    if (req.session.userId) {
        try {
            const User = require('./models/User');
            const user = await User.findById(req.session.userId);
            res.locals.currentUser = user;
        } catch (error) {
            console.error('Ошибка загрузки пользователя в middleware:', error.message);
        }
    }
    
    next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const userRoutes = require('./routes/users');

app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/works', require('./routes/works'));
app.use('/', userRoutes);
app.use('/users', userRoutes);
app.use('/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: 'Страница не найдена' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500', { title: 'Ошибка сервера' });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту http://localhost:${PORT}`);
});
