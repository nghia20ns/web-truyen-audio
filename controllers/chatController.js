// controllers/chatController.js
const Message = require('../models/Message');

// 1. Gửi tin nhắn (Dùng chung cho cả Admin và Khách)
exports.sendMessage = async (req, res) => {
    try {
        const { sessionId, content, sender, userName } = req.body;
        await Message.create({ sessionId, content, sender, userName });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2. Lấy tin nhắn của một phiên chat (Cho Khách load lịch sử)
exports.getMessages = async (req, res) => {
    try {
        const { sessionId } = req.query;
        // Lấy 50 tin gần nhất
        const messages = await Message.find({ sessionId }).sort({ createdAt: 1 }).limit(50);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. (ADMIN) Lấy danh sách các người đang chat
exports.getConversations = async (req, res) => {
    try {
        // Gom nhóm theo sessionId để lấy tin nhắn cuối cùng
        const conversations = await Message.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$sessionId",
                    lastMessage: { $first: "$content" },
                    userName: { $first: "$userName" },
                    lastTime: { $first: "$createdAt" }
                }
            },
            { $sort: { lastTime: -1 } }
        ]);
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// controllers/chatController.js

// ... (các hàm cũ giữ nguyên)

// 4. Xóa vĩnh viễn cuộc trò chuyện
exports.deleteConversation = async (req, res) => {
    try {
        const { sessionId } = req.params;
        // Xóa tất cả tin nhắn của sessionId này
        await Message.deleteMany({ sessionId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};