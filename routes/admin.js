const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController'); // Import mới
const path = require('path');
const multer = require('multer');
const fs = require('fs'); // <--- BẮT BUỘC PHẢI CÓ DÒNG NÀY
// --- 1. KHẮC PHỤC LỖI IMPORT AUTH ---
// Vì file middleware/auth.js export trực tiếp hàm, nên không dùng { }
const requireAuth = require('../middleware/auth'); 

// --- 2. CẤU HÌNH MULTER (Xử lý upload ảnh) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/';
        // <--- 2. Thêm đoạn kiểm tra này
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        // -----------------------------
        cb(null, dir); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ================= ROUTES =================

// --- AUTH ROUTES ---
router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.logout);

// --- ADMIN ROUTES (Yêu cầu đăng nhập) ---
router.get('/', requireAuth, adminController.getDashboard);

// 1. Thêm truyện
router.get('/add', requireAuth, adminController.getAddPage);
// Thêm middleware upload.single('image') để xử lý file từ form
router.post('/add', requireAuth, upload.single('image'), adminController.postAdd);

// 2. Sửa truyện
router.get('/edit/:id', requireAuth, adminController.getEditPage);
// Thêm middleware upload.single('image')
router.post('/edit/:id', requireAuth, upload.single('image'), adminController.postEdit);

// 3. Xóa truyện
router.get('/delete/:id', requireAuth, adminController.deleteTruyen);

// 4. Cấu hình thông báo
router.get('/alert', requireAuth, adminController.getAlertPage);
router.post('/alert', requireAuth, adminController.postAlert);


// ... Giữ nguyên các route login, dashboard cũ ...

// --- QUẢN LÝ DANH MỤC (Thêm đoạn này) ---
router.get('/categories', requireAuth, categoryController.getList);
router.get('/categories/add', requireAuth, categoryController.getForm);
router.post('/categories/add', requireAuth, categoryController.saveCategory);
router.get('/categories/edit/:id', requireAuth, categoryController.getForm);
router.post('/categories/edit/:id', requireAuth, categoryController.saveCategory);
router.get('/categories/delete/:id', requireAuth, categoryController.deleteCategory);
router.post('/toggle-hot/:id', requireAuth, adminController.toggleHot);

// --- QUẢN LÝ ĐƠN HÀNG ---
router.get('/orders', requireAuth, adminController.getOrders);
router.get('/orders/export-excel', requireAuth, adminController.exportOrdersExcel);
router.post('/orders/toggle/:id', requireAuth, adminController.toggleOrderStatus);
// Thêm 2 dòng này vào file routes/admin.js (nhớ đặt dưới các middleware xác thực authAdmin nếu có)
router.get('/published-chapters',requireAuth, adminController.getPublishedChaptersPage);
router.post('/published-chapters/update/:id', requireAuth, adminController.updatePublishedChapters);
// Thêm 2 dòng này vào khu vực khai báo các route admin của bạn
router.get('/quick-ytb', adminController.getQuickYtbPage);
router.post('/quick-ytb/update/:id', adminController.postQuickYtbUpdate);

// Route hiển thị giao diện Tra cứu nhanh
router.get('/quick-search', adminController.renderQuickSearch);

// Route API trả kết quả AJAX
router.get('/api/quick-search', adminController.apiQuickSearch);


module.exports = router;