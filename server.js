require('dotenv').config();
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

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

const dbLink = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/web_truyen';
mongoose.connect(dbLink)
    .then(() => console.log('✅ Đã kết nối MongoDB thành công!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// --- CẬP NHẬT SCHEMA ---
const truyenSchema = new mongoose.Schema({
    name: String,
    introduction: String,
    totalChapters: Number,
    link: String,
    shortCode: { type: String, unique: true, required: true },
    price: { type: Number, default: 1000 } // <--- THÊM: Giá tiền cho 1 tập (Mặc định 1000đ)
});
const Truyen = mongoose.model('Truyen', truyenSchema);


const requireLogin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/login');
    }
};

// --- ROUTES ---

app.get('/', async (req, res) => {
    try {
        let filter = {};
        let keyword = req.query.q || '';
        if (keyword) {
            filter.name = { $regex: keyword, $options: 'i' };
        }
        const listTruyen = await Truyen.find(filter);
        res.render('index', { listTruyen, keyword }); 
    } catch (e) {
        res.status(500).send("Lỗi Server: " + e.message);
    }
});
app.get('/truyen/:id', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.send("Lỗi ID");
    const truyen = await Truyen.findById(req.params.id);
    if (!truyen) return res.send('Không tìm thấy');

    let parts = [];
    const chunkSize = 10;
    const totalParts = Math.ceil(truyen.totalChapters / chunkSize);
    
    // Lấy giá 1 tập (nếu admin quên nhập thì mặc định là 1000đ)
    const pricePerChapter = truyen.price || 1000;

    for (let i = 0; i < totalParts; i++) {
        const start = i * chunkSize + 1;
        const end = Math.min((i + 1) * chunkSize, truyen.totalChapters);
        
        // TÍNH TIỀN TỰ ĐỘNG
        const chapterCount = end - start + 1; // Số tập trong phần này (thường là 10, phần cuối có thể ít hơn)
        const partPrice = chapterCount * pricePerChapter; // Nhân với giá 1 tập

        parts.push({ 
            name: `Tập ${start} - ${end}`, 
            code: `${start}-${end}`,
            price: partPrice,        // Lưu giá tiền để hiển thị
            priceText: partPrice.toLocaleString('vi-VN') // Định dạng số đẹp (10.000)
        });
    }
    res.render('detail', { truyen, parts });
});
app.get('/payment', async (req, res) => {
    const { truyenId, partCode } = req.query;
    if (!mongoose.Types.ObjectId.isValid(truyenId)) return res.redirect('/');
    
    const truyen = await Truyen.findById(truyenId);
    
    // TÍNH LẠI TIỀN Ở ĐÂY ĐỂ CHÍNH XÁC TUYỆT ĐỐI
    // partCode có dạng "1-10" -> Tách ra lấy số đầu và cuối
    const [start, end] = partCode.split('-').map(Number);
    const chapterCount = end - start + 1;
    const pricePerChapter = truyen.price || 1000;
    const totalAmount = chapterCount * pricePerChapter;

    res.render('payment', { 
        truyenName: truyen.name, 
        shortCode: truyen.shortCode,
        partCode: partCode,
        amount: totalAmount, // Truyền số tiền cần thanh toán sang giao diện
        amountText: totalAmount.toLocaleString('vi-VN') // Truyền dạng chữ đẹp (10.000)
    });
});
// AUTH
app.get('/login', (req, res) => {
    res.render('admin/login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('admin/login', { error: 'Sai tài khoản hoặc mật khẩu!' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ADMIN
app.get('/admin', requireLogin, async (req, res) => {
    const listTruyen = await Truyen.find();
    res.render('admin/dashboard', { listTruyen });
});

// --- UPDATE: TRANG THÊM MỚI ---
app.get('/admin/add', requireLogin, (req, res) => {
    // Truyền error: null để không bị lỗi EJS
    res.render('admin/form', { truyen: null, error: null }); 
});

app.post('/admin/add', requireLogin, async (req, res) => {
    try {
        await Truyen.create(req.body);
        res.redirect('/admin');
    } catch (err) {
        // Mã 11000 là mã lỗi trùng lặp của MongoDB
        if (err.code === 11000) {
            res.render('admin/form', { 
                truyen: req.body, // Giữ lại dữ liệu vừa nhập để đỡ phải gõ lại
                error: '❌ Từ viết tắt này đã tồn tại! Vui lòng chọn từ khác.' 
            });
        } else {
            res.send("Lỗi khác: " + err.message);
        }
    }
});

// --- UPDATE: TRANG SỬA ---
app.get('/admin/edit/:id', requireLogin, async (req, res) => {
    const truyen = await Truyen.findById(req.params.id);
    res.render('admin/form', { truyen, error: null });
});

app.post('/admin/edit/:id', requireLogin, async (req, res) => {
    try {
        await Truyen.findByIdAndUpdate(req.params.id, req.body);
        res.redirect('/admin');
    } catch (err) {
        if (err.code === 11000) {
            // Khi sửa bị trùng, ta cần ghép lại ID vào object để form biết là đang sửa
            const truyenData = req.body;
            truyenData._id = req.params.id; 
            
            res.render('admin/form', { 
                truyen: truyenData, 
                error: '❌ Từ viết tắt này đã bị trùng với truyện khác!' 
            });
        } else {
            res.send("Lỗi: " + err.message);
        }
    }
});

app.get('/admin/delete/:id', requireLogin, async (req, res) => {
    await Truyen.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Web chạy tại: http://localhost:${PORT}`);
});