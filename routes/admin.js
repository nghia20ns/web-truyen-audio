const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireLogin = require('../middleware/auth'); // Đảm bảo file này ok

// --- AUTH ROUTES ---
router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.logout);

// --- ADMIN ROUTES (Cần đăng nhập) ---
router.get('/', requireLogin, adminController.getDashboard);

// Thêm truyện
router.get('/add', requireLogin, adminController.getAddPage);
router.post('/add', requireLogin, adminController.postAdd);

// Sửa truyện
router.get('/edit/:id', requireLogin, adminController.getEditPage);
router.post('/edit/:id', requireLogin, adminController.postEdit);

// Xóa truyện (Thêm route này nếu chưa có)
router.get('/delete/:id', requireLogin, adminController.deleteTruyen);

// Cấu hình thông báo
router.get('/alert', requireLogin, adminController.getAlertPage);
router.post('/alert', requireLogin, adminController.postAlert);

module.exports = router;