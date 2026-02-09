require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session'); // <--- THƯ VIỆN MỚI
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const globalAlertMiddleware = require('./middleware/global');
const Admin = require('./models/Admin');

const app = express();

// 1. Kết nối Database
connectDB();

// 2. Cấu hình App
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 3. Cấu hình Session (Lưu thẳng vào Cookie trình duyệt)
app.use(cookieSession({
    name: 'session',
    // Khóa bí mật để mã hóa cookie (bắt buộc phải có)
    keys: [process.env.SESSION_SECRET || 'khoa_bi_mat_so_1', 'khoa_bi_mat_so_2'],
    
    // Thời gian sống: 30 ngày (Tính bằng mili giây)
    maxAge: 30 * 24 * 60 * 60 * 1000 
}));

// 4. Global Middleware
app.use(globalAlertMiddleware);

// --- HÀM TỰ ĐỘNG TẠO ADMIN ---
const createDefaultAdmin = async () => {
    try {
        setTimeout(async () => {
            const count = await Admin.countDocuments();
            if (count === 0) {
                console.log('⚠️ Chưa có Admin -> Đang tạo tài khoản mặc định...');
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('Nghia12345!', salt); // Pass: Nghia12345!
                
                await Admin.create({
                    username: 'nghia20ns',
                    password: hashedPassword
                });
                console.log('✅ Đã tạo Admin: nghia20ns');
            }
        }, 2000);
    } catch (err) {
        console.error('❌ Lỗi tạo Admin:', err);
    }
};
createDefaultAdmin();

// 5. Routes
app.use('/', require('./routes/index'));
app.use('/admin', require('./routes/admin'));
app.use('/chat', require('./routes/chat')); 

// 6. Khởi động Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Web chạy tại: http://localhost:${PORT}`);
});