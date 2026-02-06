require('dotenv').config(); // Nạp bảo mật từ file .env
const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');

// 1. Cấu hình
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Cấu hình Session (Quan trọng cho bảo mật)
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } // Phiên đăng nhập tồn tại 1 tiếng
}));

// Kết nối MongoDB (Cập nhật mới)
// Ưu tiên lấy link Online từ .env, nếu không có thì dùng link Offline
const dbLink = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/web_truyen';

mongoose.connect(dbLink)
    .then(() => console.log('✅ Đã kết nối MongoDB thành công!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));
    
// Schema Truyện (Cập nhật thêm cột link)
const truyenSchema = new mongoose.Schema({
    name: String,
    introduction: String,
    totalChapters: Number,
    link: String  // <--- THÊM DÒNG NÀY (Để lưu link truyện gốc/video)
});
const Truyen = mongoose.model('Truyen', truyenSchema);
// --- MIDDLEWARE BẢO VỆ (GATEKEEPER) ---
// Hàm này chặn người lạ truy cập vào trang Admin
const requireLogin = (req, res, next) => {
    if (req.session.isAdmin) {
        next(); // Đã đăng nhập -> Cho qua
    } else {
        res.redirect('/login'); // Chưa đăng nhập -> Đá về trang login
    }
};

// --- ROUTES ---

// 1. PUBLIC ROUTES (Ai cũng xem được)
// --- SỬA LẠI ROUTE TRANG CHỦ ---
app.get('/', async (req, res) => {
    try {
        let filter = {};
        let keyword = req.query.q || ''; // Lấy từ khóa tìm kiếm từ URL

        if (keyword) {
            // $regex: Tìm gần đúng (chứa từ khóa là được)
            // $options: 'i' nghĩa là không phân biệt hoa thường (gõ 'dau pha' vẫn ra 'Đấu Phá')
            filter.name = { $regex: keyword, $options: 'i' };
        }

        const listTruyen = await Truyen.find(filter);
        
        // Truyền thêm biến 'keyword' ra để giữ lại chữ trong ô tìm kiếm
        res.render('index', { listTruyen, keyword }); 
    } catch (e) {
        res.status(500).send("Lỗi Server: " + e.message);
    }
});

app.get('/truyen/:id', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.send("Lỗi ID");
    const truyen = await Truyen.findById(req.params.id);
    if (!truyen) return res.send('Không tìm thấy');

    // Logic chia phần
    let parts = [];
    const chunkSize = 10;
    const totalParts = Math.ceil(truyen.totalChapters / chunkSize);
    for (let i = 0; i < totalParts; i++) {
        const start = i * chunkSize + 1;
        const end = Math.min((i + 1) * chunkSize, truyen.totalChapters);
        parts.push({ name: `Phần ${start} - ${end}`, code: `${start}-${end}` });
    }
    res.render('detail', { truyen, parts });
});

app.get('/payment', async (req, res) => {
    const { truyenId, partCode } = req.query;
    if (!mongoose.Types.ObjectId.isValid(truyenId)) return res.redirect('/');
    const truyen = await Truyen.findById(truyenId);
    res.render('payment', { truyenName: truyen.name, partCode });
});

// 2. AUTH ROUTES (Đăng nhập/Đăng xuất)
app.get('/login', (req, res) => {
    res.render('admin/login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Kiểm tra với dữ liệu trong file .env
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.isAdmin = true; // Cấp thẻ bài Admin
        res.redirect('/admin');
    } else {
        res.render('admin/login', { error: 'Sai tài khoản hoặc mật khẩu!' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// 3. ADMIN ROUTES (Được bảo vệ bởi requireLogin)
app.get('/admin', requireLogin, async (req, res) => {
    const listTruyen = await Truyen.find();
    res.render('admin/dashboard', { listTruyen });
});

// Trang Thêm mới
app.get('/admin/add', requireLogin, (req, res) => {
    res.render('admin/form', { truyen: null }); // Truyền null để biết là đang thêm mới
});

app.post('/admin/add', requireLogin, async (req, res) => {
    await Truyen.create(req.body);
    res.redirect('/admin');
});

// Trang Sửa
app.get('/admin/edit/:id', requireLogin, async (req, res) => {
    const truyen = await Truyen.findById(req.params.id);
    res.render('admin/form', { truyen }); // Truyền dữ liệu cũ vào form
});

app.post('/admin/edit/:id', requireLogin, async (req, res) => {
    await Truyen.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/admin');
});

// Chức năng Xóa
app.get('/admin/delete/:id', requireLogin, async (req, res) => {
    await Truyen.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Web chạy tại: http://localhost:${PORT}`);
});