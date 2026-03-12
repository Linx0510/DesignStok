const express = require('express');
const router = express.Router();
const Work = require('../models/Work');
const User = require('../models/User');

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        
        const works = await Work.findAll('approved', limit, offset);
        let user = null;
        
        if (req.session.userId) {
            user = await User.findById(req.session.userId);
        }
        
        res.render('index', {
            title: 'Главная',
            works,
            user,
            query: null
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
});

module.exports = router;