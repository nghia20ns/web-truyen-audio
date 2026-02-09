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
// controllers/chatController.js

// ... (các hàm khác giữ nguyên)

// 3. (ADMIN) Lấy danh sách các người đang chat - ĐÃ FIX LỖI CHE TÊN
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Message.aggregate([
            // 1. Sắp xếp tin mới nhất lên đầu
            { $sort: { createdAt: -1 } }, 
            
            // 2. Gom nhóm theo Session
            {
                $group: {
                    _id: "$sessionId",
                    lastMessage: { $first: "$content" }, // Lấy nội dung tin mới nhất (của bất kỳ ai)
                    lastTime: { $first: "$createdAt" },  // Lấy thời gian mới nhất
                    
                    // --- ĐÂY LÀ PHẦN QUAN TRỌNG MỚI ---
                    // Tạo một danh sách chứa tất cả người gửi trong hội thoại này
                    sendersInfo: { 
                        $push: { 
                            sender: "$sender", 
                            name: "$userName" 
                        } 
                    }
                }
            },
            
            // 3. Lọc ra tên của Khách hàng (Bỏ qua tên Admin)
            {
                $addFields: {
                    clientInfo: { 
                        $first: { 
                            $filter: { 
                                input: "$sendersInfo", // Duyệt danh sách người gửi
                                as: "info",
                                // Chỉ lấy người nào là 'client'
                                cond: { $eq: ["$$info.sender", "client"] } 
                            } 
                        } 
                    }
                }
            },
            
            // 4. Định dạng lại kết quả cuối cùng
            {
                $project: {
                    _id: 1,
                    lastMessage: 1,
                    lastTime: 1,
                    // Nếu tìm thấy tên khách thì dùng, nếu không (trường hợp hiếm) thì để là 'Khách'
                    userName: { $ifNull: ["$clientInfo.name", "Khách"] } 
                }
            },
            
            // 5. Sắp xếp hội thoại nào mới nhắn thì lên đầu
            { $sort: { lastTime: -1 } }
        ]);
        
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
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