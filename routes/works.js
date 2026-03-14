const express = require('express');
const router = express.Router();
const workController = require('../controllers/workController');
const { isAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/upload', isAuthenticated, workController.getUpload);
router.post('/upload', isAuthenticated, upload.single('image'), workController.postUpload);
router.get('/search', workController.searchWorks);
router.get('/', workController.getWorks);
router.get('/:id', workController.getWork);
router.post('/:id/favorite', isAuthenticated, workController.addToFavorites);
router.delete('/:id/favorite', isAuthenticated, workController.removeFromFavorites);
router.post('/:id/report', isAuthenticated, workController.reportWork);
router.delete('/:id', isAuthenticated, workController.deleteOwnWork);

module.exports = router;
