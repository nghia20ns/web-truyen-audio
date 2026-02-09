// routes/chat.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const requireLogin = require('../middleware/auth'); // Dùng middleware admin có sẵn

// API cho Khách
router.post('/send', chatController.sendMessage);
router.get('/history', chatController.getMessages);

// API cho Admin (Cần login)
router.get('/admin/conversations', requireLogin, chatController.getConversations);

// Route render trang chat cho Admin (Tạo thêm view sau)
router.get('/manager', requireLogin, async (req, res) => {
    res.render('admin/chat-manager'); 
});

module.exports = router;