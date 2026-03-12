const Truyen = require('../models/Truyen');
const Category = require('../models/Category'); 
const Order = require('../models/Order'); // Model lưu giỏ hàng
const mongoose = require('mongoose');

// 1. Trang chủ + Tìm kiếm + Lọc theo Danh mục
exports.getHomePage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 100;
        const skip = (page - 1) * limit;
        
        const keyword = req.query.q || ''; 
        const catSlug = req.query.cat || ''; 

        // Lấy danh sách Categories để hiển thị menu
        const allCategories = await Category.find(); 

        // Xây dựng bộ lọc
        let filter = { isDeleted: false }; 

        // Nếu có chọn danh mục
        let currentCat = null;
        if (catSlug) {
            currentCat = await Category.findOne({ slug: catSlug });
            if (currentCat) {
                filter.categories = currentCat._id; 
            }
        }

        // Nếu có tìm kiếm
        if (keyword) {
            filter = {
                $and: [
                    filter, 
                    { 
                        $or: [ 
                            { name: { $regex: keyword, $options: 'i' } },
                            { introduction: { $regex: keyword, $options: 'i' } },
                        ]
                    }
                ]
            };
        }

        // Đếm và lấy danh sách
        const totalStories = await Truyen.countDocuments(filter);
        const totalPages = Math.ceil(totalStories / limit);

const listTruyen = await Truyen.find(filter)
            .populate('categories', 'name slug')
            .select('-link -shortCode')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // === THÊM ĐOẠN NÀY ĐỂ LẤY TRUYỆN HOT ===
        const listHot = await Truyen.find({ isHot: true, isDeleted: false })
            .select('name image totalChapters price')
            .sort({ updatedAt: -1 }) // Ưu tiên những truyện mới được tick lên Hot
            .limit(10); // Lấy tối đa 10 truyện (Bạn có thể sửa số lượng)
        // =======================================

        if (req.query.type === 'json') {
            return res.json({ listTruyen, currentPage: page, totalPages, totalStories });
        }

        res.render('index', { 
            listTruyen, 
            keyword, 
            currentPage: page, 
            totalPages,
            allCategories,      
            currentCatSlug: catSlug,
            listHot // <--- THÊM BIẾN NÀY ĐỂ TRUYỀN RA GIAO DIỆN
        }); 

    } catch (e) {
        console.error(e);
        res.status(500).send("Lỗi Server: " + e.message);
    }
};

// 2. Chi tiết truyện
exports.getTruyenDetail = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.send("Lỗi ID");
    
    const truyen = await Truyen.findOne({ _id: req.params.id, isDeleted: false });
    if (!truyen) return res.send('Không tìm thấy');

    let parts = [];
    const chunkSize = (truyen.chunkSize && truyen.chunkSize > 0) ? truyen.chunkSize : 10;
    
    const totalParts = Math.ceil(truyen.totalChapters / chunkSize);
    const pricePerChapter = truyen.price || 1000;

    for (let i = 0; i < totalParts; i++) {
        const start = i * chunkSize + 1;
        const end = Math.min((i + 1) * chunkSize, truyen.totalChapters);
        
        const chapterCount = end - start + 1;
        const partPrice = chapterCount * pricePerChapter;

        parts.push({ 
            name: `Tập ${start} - ${end}`, 
            code: `${start}-${end}`,
            price: partPrice,
            priceText: partPrice.toLocaleString('vi-VN')
        });
    }
    res.render('detail', { truyen, parts });
};

// Hàm hỗ trợ random 6 số và kiểm tra trùng lặp trong DB
async function generateUniqueCartId() {
    let isUnique = false;
    let cartId = '';
    while (!isUnique) {
        // Random từ 100000 đến 999999
        cartId = Math.floor(100000 + Math.random() * 900000).toString();
        const existingOrder = await Order.findOne({ cartId: cartId });
        if (!existingOrder) {
            isUnique = true;
        }
    }
    return cartId;
}

// 3. API Tạo Giỏ Hàng (Lưu vào DB trước khi thanh toán)
exports.createOrderCart = async (req, res) => {
    try {
        const { truyenId, selectedParts, email } = req.body;

        // Validate đầu vào
        if (!email || !email.endsWith("@gmail.com")) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đúng Gmail" });
        }
        if (!truyenId || !selectedParts || !Array.isArray(selectedParts) || selectedParts.length === 0) {
            return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất 1 tập truyện" });
        }

        const truyen = await Truyen.findById(truyenId);
        if (!truyen) {
            return res.status(404).json({ success: false, message: "Không tìm thấy truyện" });
        }

        // Tính toán tổng tiền ở backend để chống hack đổi giá ở frontend
        let totalAmount = 0;
        const pricePerChapter = truyen.price || 1000;

        selectedParts.forEach(partCode => {
            const [start, end] = partCode.split('-').map(Number);
            const chapterCount = end - start + 1;
            totalAmount += (chapterCount * pricePerChapter);
        });

        // Tạo mã ID 6 số duy nhất
        const cartId = await generateUniqueCartId();

        // Lưu giỏ hàng vào Database
        const newOrder = new Order({
            cartId: cartId,
            email: email,
            truyenId: truyen._id,
            selectedParts: selectedParts,
            totalAmount: totalAmount,
            status: 'pending'
        });

        await newOrder.save();

        // Trả về dữ liệu cho frontend để nó chuyển trang sang /payment?cartId=...
        res.json({
            success: true,
            cartId: cartId,
            totalAmount: totalAmount,
            transferContent: `IDCARD: ${cartId}`
        });

    } catch (error) {
        console.error("Lỗi tạo giỏ hàng:", error);
        res.status(500).json({ success: false, message: "Lỗi Server, vui lòng thử lại" });
    }
};

// 4. Trang Thanh Toán (Đọc dữ liệu từ Giỏ hàng hiển thị ra QR)
exports.getPayment = async (req, res) => {
    try {
        const cartId = req.query.cartId;
        if (!cartId) return res.redirect('/');

        // Tìm giỏ hàng theo mã cartId (6 số random) và lấy luôn thông tin truyện đi kèm (populate)
        const order = await Order.findOne({ cartId: cartId }).populate('truyenId');
        
        if (!order) {
            return res.send('Không tìm thấy đơn hàng hoặc đơn hàng đã hết hạn.');
        }

        res.render('payment', { 
            order: order,
            truyen: order.truyenId // Truyền thêm biến truyen để view dễ lấy tên truyện
        });
    } catch (error) {
        console.error("Lỗi trang thanh toán:", error);
        res.redirect('/');
    }
};