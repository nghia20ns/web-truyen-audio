// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbLink = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/web_truyen';
        await mongoose.connect(dbLink);
        console.log('✅ Đã kết nối MongoDB thành công!');
    } catch (err) {
        console.error('❌ Lỗi kết nối MongoDB:', err);
        process.exit(1);
    }
};

module.exports = connectDB;