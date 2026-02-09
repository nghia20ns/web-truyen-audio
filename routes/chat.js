// routes/chat.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Middleware kiểm tra Admin (Nếu file auth.js của bạn nằm ở folder middleware)
const requireLogin = require('../middleware/auth'); 

// --- ROUTE CHO KHÁCH ---
router.post('/send', chatController.sendMessage);
router.get('/history', chatController.getMessages);
router.get('/status', chatController.getStatus);

// --- ROUTE CHO ADMIN (Cần login) ---
router.get('/admin/conversations', requireLogin, chatController.getConversations);
router.delete('/delete/:sessionId', requireLogin, chatController.deleteConversation);
router.post('/toggle-status', requireLogin, chatController.toggleStatus);

// Trang quản lý Chat
router.get('/manager', requireLogin, (req, res) => {
    res.render('admin/chat-manager'); 
});

module.exports = router;