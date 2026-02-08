const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireLogin = require('../middleware/auth');

// Auth Routes
router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.logout);

// Admin Routes (Bảo vệ bằng middleware)
router.get('/', requireLogin, adminController.getDashboard);

router.get('/add', requireLogin, adminController.getAddTruyen);
router.post('/add', requireLogin, adminController.postAddTruyen);

router.get('/edit/:id', requireLogin, adminController.getEditTruyen);
router.post('/edit/:id', requireLogin, adminController.postEditTruyen);

router.get('/alert', requireLogin, adminController.getAlertConfig);
router.post('/alert', requireLogin, adminController.postAlertConfig);

module.exports = router;