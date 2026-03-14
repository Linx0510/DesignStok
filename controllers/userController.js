const User = require('../models/User');
const Work = require('../models/Work');
const Notification = require('../models/Notification');
const db = require('../config/database');

exports.getProfile = async (req, res) => {
    try {
        const userId = req.params.id ? parseInt(req.params.id, 10) : req.session.userId;

        if (!userId || Number.isNaN(userId)) {
            return res.status(404).render('404', { title: 'Пользователь не найден' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).render('404', { title: 'Пользователь не найден' });
        }
        
        let works = [];
        let favorites = [];
        let notifications = [];
        
        try {
            const worksQuery = `
                SELECT w.*, array_agg(DISTINCT t.name) as tags,
                       COUNT(DISTINCT f.user_id) as favorites_count,
                       BOOL_OR(fm.user_id IS NOT NULL) as is_favorited
                FROM works w
                LEFT JOIN work_tags wt ON w.id = wt.work_id
                LEFT JOIN tags t ON wt.tag_id = t.id
                LEFT JOIN favorites f ON w.id = f.work_id
                LEFT JOIN favorites fm ON w.id = fm.work_id AND fm.user_id = $2
                WHERE w.user_id = $1 AND w.status = 'approved'
                GROUP BY w.id
                ORDER BY w.created_at DESC
            `;
            const worksResult = await db.query(worksQuery, [userId, req.session.userId || null]);
            works = worksResult.rows;
        } catch (error) {
            console.error('Ошибка загрузки работ профиля:', error.message);
        }

        try {
            const favoritesQuery = `
                SELECT w.*, array_agg(DISTINCT t.name) as tags,
                       COUNT(DISTINCT f2.user_id) as favorites_count,
                       BOOL_OR(fm.user_id IS NOT NULL) as is_favorited
                FROM favorites f
                JOIN works w ON f.work_id = w.id
                LEFT JOIN work_tags wt ON w.id = wt.work_id
                LEFT JOIN tags t ON wt.tag_id = t.id
                LEFT JOIN favorites f2 ON w.id = f2.work_id
                LEFT JOIN favorites fm ON w.id = fm.work_id AND fm.user_id = $2
                WHERE f.user_id = $1 AND w.status = 'approved'
                GROUP BY w.id
                ORDER BY f.created_at DESC
            `;
            const favoritesResult = await db.query(favoritesQuery, [userId, req.session.userId || null]);
            favorites = favoritesResult.rows;
        } catch (error) {
            console.error('Ошибка загрузки избранного профиля:', error.message);
        }

        // Получаем уведомления
        if (userId === req.session.userId) {
            try {
                notifications = await Notification.findByUser(userId);
            } catch (error) {
                console.error('Ошибка загрузки уведомлений профиля:', error.message);
            }
        }
        

        const isOwnProfile = userId === req.session.userId;
        const isEditing = isOwnProfile && req.query.edit === '1';

        res.render('profile', {
            title: `Профиль ${user.username}`,
            works,
            favorites,
            notifications,
            isOwnProfile,
            isEditing,
            user
        });
    } catch (error) {
        console.error('Ошибка открытия профиля:', error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        const bio = typeof req.body.bio === 'string' ? req.body.bio.trim() : '';
        let avatar_path = null;

        if (!username) {
            req.flash('error', 'Имя пользователя не может быть пустым');
            return res.redirect('/profile?edit=1');
        }

        if (req.file) {
            avatar_path = '/uploads/' + req.file.filename;
        }

        await User.updateProfile(req.session.userId, { username, bio, avatar_path });

        req.flash('success', 'Профиль обновлён');
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        if (error && error.code === '23505') {
            req.flash('error', 'Пользователь с таким именем уже существует');
            return res.redirect('/profile?edit=1');
        }

        req.flash('error', 'Ошибка при обновлении профиля');
        res.redirect('/profile?edit=1');
    }
};


exports.changePassword = async (req, res) => {
    try {
        const currentPassword = req.body.currentPassword || '';
        const newPassword = req.body.newPassword || '';
        const confirmPassword = req.body.confirmPassword || '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            req.flash('error', 'Заполните все поля для смены пароля');
            return res.redirect('/profile?edit=1');
        }

        if (newPassword.length < 6) {
            req.flash('error', 'Новый пароль должен содержать минимум 6 символов');
            return res.redirect('/profile?edit=1');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'Новый пароль и подтверждение не совпадают');
            return res.redirect('/profile?edit=1');
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            req.flash('error', 'Пользователь не найден');
            return res.redirect('/profile?edit=1');
        }

        const isValidCurrentPassword = await User.comparePassword(currentPassword, user.password_hash);

        if (!isValidCurrentPassword) {
            req.flash('error', 'Текущий пароль введён неверно');
            return res.redirect('/profile?edit=1');
        }

        const isSamePassword = await User.comparePassword(newPassword, user.password_hash);

        if (isSamePassword) {
            req.flash('error', 'Новый пароль должен отличаться от текущего');
            return res.redirect('/profile?edit=1');
        }

        await User.updatePassword(req.session.userId, newPassword);

        req.flash('success', 'Пароль успешно изменён');
        return res.redirect('/profile');
    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        req.flash('error', 'Не удалось изменить пароль');
        return res.redirect('/profile?edit=1');
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

exports.markNotificationRead = async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id, 10);

        if (Number.isNaN(notificationId)) {
            return res.status(400).json({ success: false, message: 'Некорректный ID уведомления' });
        }

        await Notification.markAsRead(notificationId);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
};
