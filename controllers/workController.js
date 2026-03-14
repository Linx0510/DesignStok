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

        res.render('index', {
            title: 'Работы',
            works,
            query: null,
            user: req.session.userId ? await User.findById(req.session.userId) : null
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
        
        res.render('index', {
            title: q ? `Поиск: ${q}` : 'Главная',
            works,
            query: q,
            user: req.session.userId ? await User.findById(req.session.userId) : null
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.addToFavorites = async (req, res) => {
    try {
        const { workId } = req.body;
        
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
        const { workId } = req.body;
        
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
        const { workId, reason } = req.body;
        
        await db.query(
            'INSERT INTO complaints (reporter_user_id, work_id, reason) VALUES ($1, $2, $3)',
            [req.session.userId, workId, reason]
        );
        
        req.flash('success', 'Жалоба отправлена');
        res.redirect('back');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Ошибка при отправке жалобы');
        res.redirect('back');
    }
};
