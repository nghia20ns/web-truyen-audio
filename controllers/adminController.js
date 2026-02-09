const Admin = require('../models/Admin');
const Truyen = require('../models/Truyen');
// const Setting = require('../models/Setting'); // Bỏ dòng này vì không dùng nữa
const ThongBao = require('../models/ThongBao'); // <--- QUAN TRỌNG
const bcrypt = require('bcryptjs');

// --- 1. LOGIN / LOGOUT ---
exports.getLogin = (req, res) => {
    if (req.session.adminId) {
        return res.redirect('/admin');
    }
    res.render('admin/login', { error: null });
};

exports.postLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.render('admin/login', { error: 'Tài khoản không tồn tại!' });
        }
        
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.render('admin/login', { error: 'Sai mật khẩu rồi!' });
        }

        // Login thành công
        req.session.adminId = admin._id;
        res.redirect('/admin');

    } catch (err) {
        console.error(err);
        res.render('admin/login', { error: 'Lỗi hệ thống.' });
    }
};

exports.logout = (req, res) => {
    // Với cookie-session, gán null là xóa sạch cookie
    req.session = null; 
    res.redirect('/admin/login');
};

// --- 2. QUẢN LÝ TRUYỆN ---
exports.getDashboard = async (req, res) => {
    try {
        const listTruyen = await Truyen.find().sort({ createdAt: -1 });
        res.render('admin/dashboard', { listTruyen });
    } catch (err) {
        res.send('Lỗi tải danh sách truyện');
    }
};

exports.getAddPage = (req, res) => {
    res.render('admin/form', { truyen: null, error: null });
};

exports.postAdd = async (req, res) => {
    try {
        const { name, shortCode, totalChapters, price, link, introduction, chunkSize } = req.body;
        
        const exist = await Truyen.findOne({ shortCode });
        if (exist) {
            return res.render('admin/form', { 
                truyen: req.body, 
                error: 'Mã rút gọn này đã tồn tại!' 
            });
        }

        await Truyen.create({
            name, shortCode, totalChapters, price, link, introduction,
            chunkSize: chunkSize || 10
        });
        
        res.redirect('/admin');
    } catch (err) {
        res.render('admin/form', { truyen: req.body, error: 'Lỗi: ' + err.message });
    }
};

exports.getEditPage = async (req, res) => {
    try {
        const truyen = await Truyen.findById(req.params.id);
        if (!truyen) return res.redirect('/admin');
        res.render('admin/form', { truyen, error: null });
    } catch (err) {
        res.redirect('/admin');
    }
};

exports.postEdit = async (req, res) => {
    try {
        const { name, shortCode, totalChapters, price, link, introduction, chunkSize } = req.body;
        
        const exist = await Truyen.findOne({ shortCode, _id: { $ne: req.params.id } });
        if (exist) {
            return res.render('admin/form', { 
                truyen: { ...req.body, _id: req.params.id }, 
                error: 'Mã này đã có người dùng!' 
            });
        }

        await Truyen.findByIdAndUpdate(req.params.id, {
            name, shortCode, totalChapters, price, link, introduction,
            chunkSize: chunkSize || 10
        });

        res.redirect('/admin');
    } catch (err) {
        res.render('admin/form', { 
            truyen: { ...req.body, _id: req.params.id }, 
            error: 'Lỗi cập nhật: ' + err.message 
        });
    }
};

exports.deleteTruyen = async (req, res) => {
    try {
        await Truyen.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (err) {
        res.send('Lỗi xóa truyện');
    }
};

// --- 3. CẤU HÌNH KHÁC (ĐÃ SỬA DÙNG MODEL ThongBao) ---
exports.getAlertPage = async (req, res) => {
    try {
        // Dùng ThongBao thay vì Setting
        let alert = await ThongBao.findOne();
        
        // Nếu chưa có thì tạo object mặc định để không lỗi view
        if (!alert) {
            alert = { content: '', type: 'warning', isOn: false };
        }
        
        res.render('admin/alert-config', { globalAlert: alert });
    } catch (err) {
        console.error(err);
        res.send('Lỗi tải cấu hình: ' + err.message);
    }
};

exports.postAlert = async (req, res) => {
    try {
        const { content, type, status } = req.body;
        
        // Checkbox: tick = 'on', không tick = undefined
        const isOn = (status === 'on');

        // Tìm và cập nhật (Nếu chưa có thì tự tạo mới -> upsert: true)
        // Dùng {} để tìm document đầu tiên tìm thấy
        await ThongBao.findOneAndUpdate(
            {}, 
            { 
                content: content, 
                type: type, 
                isOn: isOn 
            },
            { upsert: true, new: true } 
        );

        res.redirect('/admin/alert');
    } catch (err) {
        console.error(err);
        res.send('Lỗi lưu cấu hình: ' + err.message);
    }
};