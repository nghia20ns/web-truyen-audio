const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const adminController = require('../controllers/adminController');

// 1. Thêm 2 dòng này để nạp Chat và Middleware bảo vệ Admin
const chatController = require('../controllers/chatController');
const requireLogin = require('../middleware/auth'); 

// --- ROUTE CHO KHÁCH ---
router.get('/', clientController.getHomePage);
router.get('/truyen/:id', clientController.getTruyenDetail);
router.get('/payment', clientController.getPayment);
router.post('/create-payment-link', clientController.createPaymentLink);

// --- ROUTE CHO ADMIN (LOGIN/LOGOUT) ---
router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.logout);

// =========================================================
// --- THÊM ROUTE CHAT VÀO ĐÂY (Để sửa lỗi Cannot GET) ---
// =========================================================

// 1. API Gửi/Nhận tin nhắn (Dành cho cả Khách & Admin)
router.post('/chat/send', chatController.sendMessage);
router.get('/chat/history', chatController.getMessages);

// 2. API Lấy danh sách người chat (Chỉ Admin xem được)
router.get('/chat/admin/conversations', requireLogin, chatController.getConversations);

// 3. Trang Quản lý Chat (Giao diện Admin) -> Link: /chat/manager
router.get('/chat/manager', requireLogin, (req, res) => {
    res.render('admin/chat-manager'); // Render file views/admin/chat-manager.ejs
});
router.delete('/chat/delete/:sessionId', requireLogin, chatController.deleteConversation);
// API Bật/Tắt (Dành cho Admin)
router.post('/chat/toggle-status', requireLogin, chatController.toggleStatus);

// API Kiểm tra trạng thái (Dành cho Khách)
router.get('/chat/status', chatController.getStatus);
module.exports = router;