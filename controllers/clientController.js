const Truyen = require('../models/Truyen');
const Category = require('../models/Category'); 
const Order = require('../models/Order'); // Model lưu giỏ hàng
const mongoose = require('mongoose');

// 1. Trang chủ + Tìm kiếm + Lọc theo Danh mục (Tối ưu hóa cuộn vô hạn chống sót truyện)
exports.getHomePage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 16; // Số lượng truyện tải mỗi lượt (Bạn có thể đổi thành 12 tùy ý)
        const skip = (page - 1) * limit;
        
        const keyword = req.query.q || ''; 
        const catSlug = req.query.cat || ''; 

        // Lấy danh sách Categories để hiển thị menu
        const allCategories = await Category.find(); 

        // Xây dựng bộ lọc dữ liệu mặc định
        let filter = { isDeleted: false }; 

        // Nếu người dùng chọn lọc theo danh mục
        let currentCat = null;
        if (catSlug) {
            currentCat = await Category.findOne({ slug: catSlug });
            if (currentCat) {
                filter.categories = currentCat._id; 
            }
        }

        // Nếu người dùng sử dụng thanh tìm kiếm trực tiếp (Live Search)
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

        // CHẠY SONG SONG BA TRUY VẤN: Đếm tổng số truyện, Lấy danh sách phân trang, và Lấy danh sách truyện HOT
        // Việc thêm `_id: -1` vào hàm .sort giúp cố định thứ tự tuyệt đối, giải quyết triệt để lỗi sót truyện khi lướt cuộn
        const [totalStories, listTruyen, listHot] = await Promise.all([
            Truyen.countDocuments(filter),
            Truyen.find(filter)
                .populate('categories', 'name slug')
                .select('-link -shortCode')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1, _id: -1 }), // <-- CỐ ĐỊNH THỨ TỰ TUYỆT ĐỐI CHỐNG SÓT/TRÙNG
            Truyen.find({ isHot: true, isDeleted: false })
                .select('name image totalChapters price')
                .sort({ updatedAt: -1 }) // Ưu tiên những truyện mới được tick Hot lên đầu
                .limit(10) // Lấy tối đa 10 truyện Hot hiển thị ở thanh trượt ngang
        ]);

        // Tính toán tổng số trang dựa trên lượng dữ liệu thực tế đã lọc
        const totalPages = Math.ceil(totalStories / limit);

        // Nếu Client gửi yêu cầu AJAX lấy thêm dữ liệu khi lướt cuộn (type=json)
        if (req.query.type === 'json') {
            return res.json({ listTruyen, currentPage: page, totalPages, totalStories });
        }

        // Nếu người dùng truy cập trực tiếp bằng trình duyệt (Nạp giao diện ban đầu)
        res.render('index', { 
            listTruyen, 
            keyword, 
            currentPage: page, 
            totalPages,
            allCategories,      
            currentCatSlug: catSlug,
            listHot
        }); 

    } catch (e) {
        console.error("Lỗi tại getHomePage:", e);
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
    
    // Lấy số tập đã public từ DB (nếu không có thì mặc định là 0)
    const publishedChapters = truyen.publishedChapters || 0;

    for (let i = 0; i < totalParts; i++) {
        let start = i * chunkSize + 1;
        let end = Math.min((i + 1) * chunkSize, truyen.totalChapters);
        
        // Cập nhật lại số bắt đầu nếu nằm trong khoảng tập đã public
        if (publishedChapters >= start) {
            start = publishedChapters + 1;
        }

        // Nếu toàn bộ gói này đã được public (ví dụ gói 1-5 mà public 6 tập) thì bỏ qua
        if (start > end) {
            continue;
        }

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