const User = require('../models/User');
const Work = require('../models/Work');
const Notification = require('../models/Notification');
const db = require('../config/database');

exports.getProfile = async (req, res) => {
    try {
        const userId = req.params.id ? parseInt(req.params.id, 10) : req.session.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).render('404', { title: 'Пользователь не найден' });
        }
        
        // Получаем работы пользователя
        const worksQuery = `
            SELECT w.*, array_agg(DISTINCT t.name) as tags
            FROM works w
            LEFT JOIN work_tags wt ON w.id = wt.work_id
            LEFT JOIN tags t ON wt.tag_id = t.id
            WHERE w.user_id = $1 AND w.status = 'approved'
            GROUP BY w.id
            ORDER BY w.created_at DESC
        `;
        const works = await db.query(worksQuery, [userId]);
        
        // Получаем избранное пользователя
        const favoritesQuery = `
            SELECT w.*, array_agg(DISTINCT t.name) as tags
            FROM favorites f
            JOIN works w ON f.work_id = w.id
            LEFT JOIN work_tags wt ON w.id = wt.work_id
            LEFT JOIN tags t ON wt.tag_id = t.id
            WHERE f.user_id = $1 AND w.status = 'approved'
            GROUP BY w.id
            ORDER BY f.created_at DESC
        `;
        const favorites = await db.query(favoritesQuery, [userId]);
        
        // Получаем уведомления
        let notifications = [];
        if (userId === req.session.userId) {
            notifications = await Notification.findByUser(userId);
        }
        
        res.render('profile', {
            title: `Профиль ${user.username}`,
            works: works.rows,
            favorites: favorites.rows,
            notifications,
            isOwnProfile: userId === req.session.userId,
            user
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { username, bio } = req.body;
        let avatar_path = null;
        
        if (req.file) {
            avatar_path = '/uploads/' + req.file.filename;
        }
        
        await User.updateProfile(req.session.userId, { username, bio, avatar_path });
        
        req.flash('success', 'Профиль обновлен');
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Ошибка при обновлении профиля');
        res.redirect('/profile');
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        await Notification.markAsRead(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};

exports.markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.markAllAsRead(req.session.userId);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};