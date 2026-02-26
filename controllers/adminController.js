const Admin = require('../models/Admin');
const Truyen = require('../models/Truyen');
const ThongBao = require('../models/ThongBao'); 
const bcrypt = require('bcryptjs');
const cloudinary = require('../config/cloudinary'); 
const fs = require('fs');
const Category = require('../models/Category'); // <-- QUAN TRỌNG: Nhớ import dòng này
const Order = require('../models/Order');
// --- 1. LOGIN / LOGOUT (Giữ nguyên) ---
exports.getLogin = (req, res) => {
    if (req.session.adminId) return res.redirect('/admin');
    res.render('admin/login', { error: null });
};

exports.postLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            return res.render('admin/login', { error: 'Sai tài khoản hoặc mật khẩu!' });
        }
        req.session.adminId = admin._id;
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.render('admin/login', { error: 'Lỗi hệ thống.' });
    }
};

exports.logout = (req, res) => {
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

exports.getAddPage = async (req, res) => { // Thêm async
    const categories = await Category.find(); // Lấy list category
    res.render('admin/form', { truyen: null, error: null, categories }); // Truyền categories qua view
};
// Xử lý Thêm Mới
exports.postAdd = async (req, res) => {
    try {
        const { name, shortCode, totalChapters, price, link, introduction, chunkSize } = req.body;
        
        const exist = await Truyen.findOne({ shortCode });
        if (exist) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.render('admin/form', { truyen: req.body, error: 'Mã rút gọn này đã tồn tại!' });
        }

        let imageUrl = '';
        if (req.file) {
            try {
                const result = await cloudinary.uploader.upload(req.file.path, { folder: 'web-truyen-audio', use_filename: true });
                imageUrl = result.secure_url;
                fs.unlinkSync(req.file.path);
            } catch (e) { console.error('Lỗi upload ảnh:', e); }
        }

        await Truyen.create({
            name, shortCode, totalChapters, price, link, introduction,
            chunkSize: chunkSize || 10,
            image: imageUrl
        });
        res.redirect('/admin');
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.render('admin/form', { truyen: req.body, error: 'Lỗi: ' + err.message });
    }
};

// Hiển thị trang Sửa (QUAN TRỌNG: Kiểm tra hàm này)
exports.getEditPage = async (req, res) => {
    try {
        const truyen = await Truyen.findById(req.params.id);
        const categories = await Category.find(); // Lấy list category
        if (!truyen) return res.redirect('/admin');
        res.render('admin/form', { truyen, error: null, categories }); // Truyền categories qua view
    } catch (err) { /*...*/ }
};

// Xử lý Cập nhật
exports.postEdit = async (req, res) => {
    try {
        const { name, shortCode, totalChapters, price, link, introduction, chunkSize } = req.body;
        const exist = await Truyen.findOne({ shortCode, _id: { $ne: req.params.id } });
        
        if (exist) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.render('admin/form', { truyen: { ...req.body, _id: req.params.id }, error: 'Mã này đã có người dùng!' });
        }

        let updateData = { name, shortCode, totalChapters, price, link, introduction, chunkSize: chunkSize || 10 };

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, { folder: 'web-truyen-audio' });
            updateData.image = result.secure_url;
            fs.unlinkSync(req.file.path);
        }

        await Truyen.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin');
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.render('admin/form', { truyen: { ...req.body, _id: req.params.id }, error: 'Lỗi cập nhật: ' + err.message });
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

// --- 3. CẤU HÌNH KHÁC ---
exports.getAlertPage = async (req, res) => {
    try {
        let alert = await ThongBao.findOne();
        if (!alert) alert = { content: '', type: 'warning', isOn: false };
        res.render('admin/alert-config', { globalAlert: alert });
    } catch (err) { res.send('Lỗi: ' + err.message); }
};

exports.postAlert = async (req, res) => {
    try {
        const { content, type, status } = req.body;
        await ThongBao.findOneAndUpdate({}, { content, type, isOn: (status === 'on') }, { upsert: true, new: true });
        res.redirect('/admin/alert');
    } catch (err) { res.send('Lỗi: ' + err.message); }
};

// --- XỬ LÝ NÚT TICK HOT Ở DASHBOARD ---
exports.toggleHot = async (req, res) => {
    try {
        const { isHot } = req.body;
        await Truyen.findByIdAndUpdate(req.params.id, { isHot });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- QUẢN LÝ ĐƠN HÀNG ---
exports.getOrders = async (req, res) => {
    try {
        // Lấy danh sách order, populate truyenId để lấy thông tin truyện (như link, tên)
        const orders = await Order.find().populate('truyenId').sort({ createdAt: -1 });
        res.render('admin/order-list', { orders });
    } catch (err) {
        res.send('Lỗi tải danh sách đơn hàng: ' + err.message);
    }
};

exports.toggleOrderStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        
        // Đảo ngược trạng thái isProcessed
        order.isProcessed = !order.isProcessed;
        await order.save();
        
        res.json({ success: true, isProcessed: order.isProcessed });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};