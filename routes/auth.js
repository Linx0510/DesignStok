const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Страница входа
router.get('/login', authController.getLogin);

// Обработка входа
router.post('/login', authController.postLogin);

// Страница регистрации
router.get('/register', authController.getRegister);

// Обработка регистрации
router.post('/register', authController.postRegister);

// Выход
router.get('/logout', authController.logout);

module.exports = router;