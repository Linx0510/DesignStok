const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/profile', isAuthenticated, userController.getProfile);
router.get('/profile/:id', userController.getProfile);

module.exports = router;
