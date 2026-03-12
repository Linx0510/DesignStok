const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middleware/admin');

router.use(adminMiddleware);

router.get('/', adminController.getDashboard);
router.get('/moderation', adminController.getModeration);
router.post('/works/:id/approve', adminController.approveWork);
router.post('/works/:id/reject', adminController.rejectWork);
router.get('/complaints', adminController.getComplaints);
router.post('/complaints/:id/close', adminController.closeComplaint);
router.post('/works/:id/delete', adminController.deleteWork);

module.exports = router;