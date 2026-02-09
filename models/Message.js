const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true }, 
    userName: { type: String, default: 'Khách' },             
    sender: { type: String, required: true },                 
    content: { type: String, required: true },                
    isRead: { type: Boolean, default: false },
    
    // --- THÊM ĐOẠN NÀY ĐỂ TỰ XÓA ---
    createdAt: { 
        type: Date, 
        default: Date.now, 
        expires: 86400 // 86400 giây = 1 ngày (Sau 1 ngày tin nhắn tự biến mất)
    }
});

// Lưu ý: Đã bỏ option { timestamps: true } vì chúng ta tự khai báo createdAt ở trên rồi
module.exports = mongoose.model('Message', messageSchema);