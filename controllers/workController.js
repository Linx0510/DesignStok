const Work = require('../models/Work');
const Notification = require('../models/Notification');
const db = require('../config/database');
const User = require('../models/User');

exports.getUpload = (req, res) => {
    res.render('upload', { 
        title: 'Загрузить работу',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

exports.getWorks = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const works = await Work.findAll('approved', limit, offset);
        const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;

        if (currentUser && works.length > 0) {
            const favoriteResult = await db.query(
                'SELECT work_id FROM favorites WHERE user_id = $1 AND work_id = ANY($2::int[])',
                [currentUser.id, works.map((work) => work.id)]
            );
            const favoriteIds = new Set(favoriteResult.rows.map((row) => row.work_id));
            works.forEach((work) => {
                work.is_favorited = favoriteIds.has(work.id);
            });
        } else {
            works.forEach((work) => {
                work.is_favorited = false;
            });
        }

        res.render('index', {
            title: 'Работы',
            works,
            query: null,
            user: currentUser,
            currentUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.postUpload = async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error', 'Пожалуйста, выберите изображение');
            return res.redirect('/works/upload');
        }
        
        const { title, description, tags } = req.body;
        const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
        
        const workId = await Work.create(
            req.session.userId,
            title,
            description,
            '/uploads/' + req.file.filename,
            tagArray
        );
        
        req.flash('success', 'Работа успешно загружена и отправлена на модерацию');
        res.redirect(`/works/${workId}`);
    } catch (error) {
        console.error(error);
        req.flash('error', 'Ошибка при загрузке работы');
        res.redirect('/works/upload');
    }
};

exports.getWork = async (req, res) => {
    try {
        const work = await Work.findById(req.params.id);
        if (!work) {
            return res.status(404).render('404', { title: 'Страница не найдена' });
        }
        
        // Проверяем, добавлена ли работа в избранное текущим пользователем
        let isFavorited = false;
        if (req.session.userId) {
            const favQuery = 'SELECT * FROM favorites WHERE user_id = $1 AND work_id = $2';
            const favResult = await db.query(favQuery, [req.session.userId, work.id]);
            isFavorited = favResult.rows.length > 0;
        }
        
        const currentUser = req.session.userId
            ? await User.findById(req.session.userId)
            : null;

        res.render('works', {
            title: work.title,
            work,
            isFavorited,
            user: currentUser,
            currentUser,
            similarWorks: []
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.searchWorks = async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        
        let works = [];
        if (q) {
            works = await Work.search(q, limit, offset);
        } else {
            works = await Work.findAll('approved', limit, offset);
        }

        const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;

        if (currentUser && works.length > 0) {
            const favoriteResult = await db.query(
                'SELECT work_id FROM favorites WHERE user_id = $1 AND work_id = ANY($2::int[])',
                [currentUser.id, works.map((work) => work.id)]
            );
            const favoriteIds = new Set(favoriteResult.rows.map((row) => row.work_id));
            works.forEach((work) => {
                work.is_favorited = favoriteIds.has(work.id);
            });
        } else {
            works.forEach((work) => {
                work.is_favorited = false;
            });
        }
        
        res.render('index', {
            title: q ? `Поиск: ${q}` : 'Главная',
            works,
            query: q,
            user: currentUser,
            currentUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.addToFavorites = async (req, res) => {
    try {
        const workId = req.params.id || req.body.workId;

        if (!workId) {
            return res.status(400).json({ success: false, error: 'Не указан идентификатор работы' });
        }

        const work = await Work.findById(workId);
        if (!work) {
            return res.status(404).json({ success: false, error: 'Работа не найдена' });
        }
        
        // Проверяем, не добавлена ли уже работа
        const checkQuery = 'SELECT * FROM favorites WHERE user_id = $1 AND work_id = $2';
        const checkResult = await db.query(checkQuery, [req.session.userId, workId]);
        
        if (checkResult.rows.length === 0) {
            await db.query(
                'INSERT INTO favorites (user_id, work_id) VALUES ($1, $2)',
                [req.session.userId, workId]
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Ошибка при добавлении в избранное' });
    }
};

exports.removeFromFavorites = async (req, res) => {
    try {
        const workId = req.params.id || req.body.workId;

        if (!workId) {
            return res.status(400).json({ success: false, error: 'Не указан идентификатор работы' });
        }
        
        await db.query(
            'DELETE FROM favorites WHERE user_id = $1 AND work_id = $2',
            [req.session.userId, workId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Ошибка при удалении из избранного' });
    }
};

exports.reportWork = async (req, res) => {
    try {
        const workId = parseInt(req.params.id || req.body.workId, 10);
        const reasonLabels = {
            copyright: 'Нарушение авторских прав',
            inappropriate: 'Неприемлемое содержание',
            spam: 'Спам',
            offensive: 'Оскорбительный контент'
        };

        const rawReason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        const customReason = typeof req.body.other_reason === 'string' ? req.body.other_reason.trim() : '';
        const reason = reasonLabels[rawReason] || (rawReason === 'other' ? customReason : rawReason);

        if (Number.isNaN(workId) || !reason) {
            req.flash('error', 'Укажите причину жалобы');
            return res.redirect('back');
        }
        
        await db.query(
            'INSERT INTO complaints (reporter_user_id, work_id, reason, status) VALUES ($1, $2, $3, $4)',
            [req.session.userId, workId, reason, 'open']
        );
        
        req.flash('success', 'Жалоба отправлена');
        res.redirect('back');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Ошибка при отправке жалобы');
        res.redirect('back');
    }
};

exports.deleteOwnWork = async (req, res) => {
    try {
        const workId = parseInt(req.params.id, 10);

        if (Number.isNaN(workId)) {
            return res.status(400).json({ success: false, error: 'Некорректный идентификатор работы' });
        }

        const workResult = await db.query(
            'SELECT id, user_id FROM works WHERE id = $1 LIMIT 1',
            [workId]
        );

        if (workResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Работа не найдена' });
        }

        const work = workResult.rows[0];
        if (work.user_id !== req.session.userId) {
            return res.status(403).json({ success: false, error: 'Можно удалить только свою работу' });
        }

        await Work.delete(workId);

        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Ошибка при удалении работы' });
    }
};
