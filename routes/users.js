const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/profile', isAuthenticated, userController.getProfile);
router.get('/profile/:id', userController.getProfile);
router.post('/profile/update', isAuthenticated, upload.single('avatar'), userController.updateProfile);
router.post('/profile/change-password', isAuthenticated, userController.changePassword);
router.post('/notifications/:id/read', isAuthenticated, userController.markNotificationRead);
router.post('/notifications/read-all', isAuthenticated, userController.markAllNotificationsRead);

module.exports = router;