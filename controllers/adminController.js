const Truyen = require('../models/Truyen');
const ThongBao = require('../models/ThongBao');

// --- AUTH ---
exports.getLogin = (req, res) => {
    res.render('admin/login', { error: null });
};

exports.postLogin = (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('admin/login', { error: 'Sai tài khoản hoặc mật khẩu!' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
};

// --- DASHBOARD ---
exports.getDashboard = async (req, res) => {
    const listTruyen = await Truyen.find({ isDeleted: false }).sort({ createdAt: -1 });
    res.render('admin/dashboard', { listTruyen });
};

// --- CRUD TRUYỆN ---
exports.getAddTruyen = (req, res) => {
    res.render('admin/form', { truyen: null, error: null }); 
};

exports.postAddTruyen = async (req, res) => {
    try {
        await Truyen.create(req.body);
        res.redirect('/admin');
    } catch (err) {
        if (err.code === 11000) {
            res.render('admin/form', { 
                truyen: req.body, 
                error: '❌ Từ viết tắt này đã tồn tại!' 
            });
        } else {
            res.send("Lỗi: " + err.message);
        }
    }
};

exports.getEditTruyen = async (req, res) => {
    const truyen = await Truyen.findById(req.params.id);
    res.render('admin/form', { truyen, error: null });
};

exports.postEditTruyen = async (req, res) => {
    try {
        await Truyen.findByIdAndUpdate(req.params.id, req.body);
        res.redirect('/admin');
    } catch (err) {
        if (err.code === 11000) {
            const truyenData = req.body;
            truyenData._id = req.params.id; 
            res.render('admin/form', { 
                truyen: truyenData, 
                error: '❌ Từ viết tắt bị trùng!' 
            });
        } else {
            res.send("Lỗi: " + err.message);
        }
    }
};

// --- CẤU HÌNH ALERT ---
exports.getAlertConfig = async (req, res) => {
    res.render('admin/alert-config');
};

exports.postAlertConfig = async (req, res) => {
    const { content, type, status } = req.body;
    await ThongBao.findOneAndUpdate({}, {
        content: content,
        type: type,
        isOn: status === 'on' ? true : false
    }, { upsert: true });
    res.redirect('/admin/alert');
};