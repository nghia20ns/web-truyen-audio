// controllers/chatController.js
const Message = require('../models/Message'); // Đảm bảo bạn có models/Message.js
const Setting = require('../models/Setting'); // Đảm bảo bạn có models/Setting.js

// 1. Gửi tin nhắn
exports.sendMessage = async (req, res) => {
    try {
        const { sessionId, content, sender, userName } = req.body;
        await Message.create({ sessionId, content, sender, userName });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2. Lấy lịch sử tin nhắn
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

// 3. (ADMIN) Lấy danh sách hội thoại
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Message.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$sessionId",
                    lastMessage: { $first: "$content" },
                    lastTime: { $first: "$createdAt" },
                    // Lấy tên người dùng (ưu tiên sender='client')
                    sendersInfo: { $push: { sender: "$sender", name: "$userName" } }
                }
            },
            {
                $addFields: {
                    clientInfo: { 
                        $first: { 
                            $filter: { 
                                input: "$sendersInfo", 
                                as: "info", 
                                cond: { $eq: ["$$info.sender", "client"] } 
                            } 
                        } 
                    }
                }
            },
            {
                $project: {
                    _id: 1, lastMessage: 1, lastTime: 1,
                    userName: { $ifNull: ["$clientInfo.name", "Khách"] }
                }
            },
            { $sort: { lastTime: -1 } }
        ]);
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 4. (ADMIN) Xóa hội thoại
exports.deleteConversation = async (req, res) => {
    try {
        await Message.deleteMany({ sessionId: req.params.sessionId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 5. Kiểm tra trạng thái Online
exports.getStatus = async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'chat_status' });
        res.json({ isOnline: setting ? setting.value : true });
    } catch (err) {
        res.json({ isOnline: true });
    }
};

// 6. Bật/Tắt trạng thái Online
exports.toggleStatus = async (req, res) => {
    try {
        let setting = await Setting.findOne({ key: 'chat_status' });
        if (!setting) setting = await Setting.create({ key: 'chat_status', value: true });
        
        setting.value = !setting.value;
        await setting.save();
        
        res.json({ success: true, isOnline: setting.value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};