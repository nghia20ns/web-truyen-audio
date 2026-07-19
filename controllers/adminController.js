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
        // 1. Nhận thêm link và linkYtb từ req.body (bỏ trường link cũ)
        const { name, shortCode, totalChapters, price, link, linkYtb, introduction, chunkSize, publishedChapters } = req.body;

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

        // 2. Tạo bản ghi truyện mới với link và linkYtb
        await Truyen.create({
            name, 
            shortCode, 
            totalChapters, 
            price, 
            link: link || '', // Lưu link Drive
            linkYtb: linkYtb || '',     // Lưu link Youtube
            introduction,
            chunkSize: chunkSize || 10,
            publishedChapters: publishedChapters || 0,
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
        // 1. Nhận thêm link và linkYtb từ dữ liệu form gửi lên
        const { name, shortCode, totalChapters, price, link, linkYtb, introduction, chunkSize, publishedChapters } = req.body;
        const exist = await Truyen.findOne({ shortCode, _id: { $ne: req.params.id } });
        
        if (exist) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.render('admin/form', { truyen: { ...req.body, _id: req.params.id }, error: 'Mã này đã có người dùng!' });
        }

        // 2. Cập nhật object dữ liệu mới để đẩy vào DB
        let updateData = { 
            name, 
            shortCode, 
            totalChapters, 
            price, 
            link: link || '', // Cập nhật link Drive
            linkYtb: linkYtb || '',     // Cập nhật link Youtube
            introduction, 
            chunkSize: chunkSize || 10, 
            publishedChapters: publishedChapters || 0
        };

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
const ExcelJS = require('exceljs'); // Khai báo thư viện exceljs ở đầu vùng quản lý đơn hàng

exports.getOrders = async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        // Nếu có từ khóa tìm kiếm, lọc theo cartId (Mã đơn) hoặc email (Gmail)
        if (search) {
            query = {
                $or: [
                    { cartId: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Lấy danh sách order, populate truyenId để lấy thông tin truyện (như link, tên)
        const orders = await Order.find(query).populate('truyenId').sort({ createdAt: -1 });
        
        // Truyền thêm biến search ngược lại cho view để hiển thị vào thanh ô nhập liệu
        res.render('admin/order-list', { orders, search: search || '' });
    } catch (err) {
        res.send('Lỗi tải danh sách đơn hàng: ' + err.message);
    }
};

// API / Route xuất file Excel đơn hàng hoàn tất (Đã bỏ cột Link Truyện)
exports.exportOrdersExcel = async (req, res) => {
    try {
        // Chỉ lấy các đơn hàng có trạng thái isProcessed = true (Hoàn tất)
        const orders = await Order.find({ isProcessed: true }).populate('truyenId').sort({ createdAt: -1 });

        // Tạo một workbook mới
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Đơn hàng hoàn tất');

        // Định nghĩa cấu trúc các cột (Đã xóa cột Link Truyện)
        worksheet.columns = [
            { header: 'ID Card (Mã Đơn)', key: 'cartId', width: 25 },
            { header: 'Gmail Khách Hàng', key: 'email', width: 30 },
            { header: 'Mã Truyện', key: 'shortCode', width: 20 },
            { header: 'Phần Mua', key: 'selectedParts', width: 25 },
            { header: 'Tổng Tiền Thanh Toán', key: 'totalAmount', width: 25 },
            { header: 'Ngày Tạo', key: 'createdAt', width: 20 }
        ];

        // Định dạng tiêu đề cột (In đậm, nền xám nhẹ)
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F2F2F2' }
            };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // Thêm dữ liệu vào bảng tính
        orders.forEach(order => {
            worksheet.addRow({
                cartId: order.cartId,
                email: order.email,
                shortCode: order.truyenId ? (order.truyenId.shortCode || order.truyenId._id) : 'Đã xóa',
                selectedParts: order.selectedParts ? order.selectedParts.join(', ') : '',
                totalAmount: order.totalAmount,
                createdAt: new Date(order.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
            });
        });

        // Áp dụng định dạng số (tiền tệ) cho cột tổng tiền
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                const priceCell = row.getCell('totalAmount');
                priceCell.numberFormat = '#,##0'; // Định dạng hiển thị ví dụ: 50,000
            }
        });

        // Thiết lập thông tin phản hồi của file tải về
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=don_hang_hoan_tat_' + Date.now() + '.xlsx');

        // Ghi dữ liệu luồng trực tiếp ra phản hồi res
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        res.status(500).send('Lỗi xuất file Excel: ' + err.message);
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

// --- QUẢN LÝ NHANH TẬP PUBLIC ---

// 1. Hiển thị trang danh sách
exports.getPublishedChaptersPage = async (req, res) => {
    try {
        // Lấy tất cả truyện, ưu tiên truyện mới cập nhật lên đầu
        const listTruyen = await Truyen.find().sort({ updatedAt: -1 });
        res.render('admin/published-chapters', { listTruyen });
    } catch (err) {
        res.status(500).send('Lỗi tải danh sách: ' + err.message);
    }
};

// 2. API Cập nhật bằng AJAX
exports.updatePublishedChapters = async (req, res) => {
    try {
        const { id } = req.params;
        const { publishedChapters } = req.body;
        
        await Truyen.findByIdAndUpdate(id, { publishedChapters: Number(publishedChapters) });
        res.json({ success: true, message: "Cập nhật thành công" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// [GET] Hiển thị trang cập nhật nhanh link youtube
exports.getQuickYtbPage = async (req, res) => {
    try {
        // Lấy danh sách toàn bộ truyện xếp theo bảng chữ cái hoặc mới nhất
        const listTruyen = await Truyen.find().sort({ _id: -1 });
        res.render('admin/quick-ytb', { listTruyen, error: null });
    } catch (err) {
        res.status(500).send("Lỗi máy chủ: " + err.message);
    }
};

// [POST] Xử lý cập nhật nhanh qua API (Không làm thay đổi mục hot)
exports.postQuickYtbUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { linkYtb } = req.body;

        // Chỉ cập nhật duy nhất trường linkYtb. 
        // Không chỉnh sửa trường updatedAt hoặc các trường nổi bật hot nếu hệ thống của bạn có sử dụng.
        await Truyen.findByIdAndUpdate(id, 
            { $set: { linkYtb: linkYtb || '' } },
            { timestamps: false } // Ngăn mongoose tự động làm mới thời gian update (nếu schema có bật timestamps)
        );

        return res.json({ success: true, message: 'Cập nhật thành công!' });
    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
};
