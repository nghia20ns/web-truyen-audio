const Truyen = require('../models/Truyen');
const Category = require('../models/Category'); 
const Order = require('../models/Order'); // Model lưu giỏ hàng
const mongoose = require('mongoose');

// Hàm chuẩn hóa tiếng Việt & ký tự đặc biệt
function normalizeText(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Hàm lấy chữ cái đầu (acronym)
function getAcronym(str) {
    const clean = normalizeText(str);
    if (!clean) return '';
    return clean.split(' ').map(w => w[0]).join('');
}

// 1. Trang chủ + Tìm kiếm linh hoạt + Lọc theo Danh mục
exports.getHomePage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 16;
        const skip = (page - 1) * limit;

        const rawKeyword = (req.query.q || req.query.keyword || '').trim();
        const catSlug = req.query.cat || '';

        // Lấy danh sách Categories & Danh sách Hot
        const [allCategories, listHot] = await Promise.all([
            Category.find(),
            Truyen.find({ isHot: true, isDeleted: false })
                .select('name title tenTruyen image hinhAnh totalChapters price gia')
                .sort({ updatedAt: -1 })
                .limit(10)
                .lean()
        ]);

        // Điều kiện danh mục (nếu có)
        let baseFilter = { isDeleted: false };
        let currentCat = null;
        if (catSlug) {
            currentCat = await Category.findOne({ slug: catSlug });
            if (currentCat) {
                baseFilter.categories = currentCat._id;
            }
        }

        let listTruyen = [];
        let totalStories = 0;

        // TRƯỜNG HỢP 1: Có từ khóa tìm kiếm (Áp dụng thuật toán tính điểm thông minh)
        if (rawKeyword) {
            const normalizedKey = normalizeText(rawKeyword);
            const searchTokens = normalizedKey.split(' ').filter(Boolean);
            const compactKey = normalizedKey.replace(/\s+/g, '');

            // Lấy danh sách truyện theo danh mục để lọc và chấm điểm
            const candidateStories = await Truyen.find(baseFilter)
                .populate('categories', 'name slug')
                .select('-link -linkDrive -driveLink')
                .lean();

            const scoredResults = [];

            for (const story of candidateStories) {
                const name = story.name || story.tenTruyen || story.title || '';
                const author = story.author || story.tacGia || '';
                const intro = story.introduction || story.moTa || story.description || '';
                const customShortCode = story.shortCode || '';

                const normName = normalizeText(name);
                const normAuthor = normalizeText(author);
                const normIntro = normalizeText(intro);
                const acronym = getAcronym(name);

                let score = 0;

                // A. Khớp chính xác cụm từ
                if (normName === normalizedKey) {
                    score += 100;
                } else if (normName.startsWith(normalizedKey)) {
                    score += 60;
                } else if (normName.includes(normalizedKey)) {
                    score += 40;
                }

                // B. Khớp viết tắt (ShortCode / Acronym)
                if (customShortCode && normalizeText(customShortCode) === compactKey) {
                    score += 90;
                } else if (acronym === compactKey) {
                    score += 80;
                } else if (acronym.includes(compactKey) && compactKey.length >= 2) {
                    score += 45;
                }

                // C. Khớp theo từng từ khóa (Token Matching)
                let tokenMatches = 0;
                for (const token of searchTokens) {
                    if (normName.includes(token)) {
                        tokenMatches += 2;
                    } else if (normAuthor.includes(token) || normIntro.includes(token)) {
                        tokenMatches += 1;
                    }
                }

                if (tokenMatches > 0) {
                    score += (tokenMatches / (searchTokens.length * 2)) * 30;
                }

                if (score > 0) {
                    scoredResults.push({ story, score });
                }
            }

            // Sắp xếp theo điểm liên quan cao nhất
            scoredResults.sort((a, b) => b.score - a.score);

            totalStories = scoredResults.length;
            listTruyen = scoredResults.slice(skip, skip + limit).map(item => item.story);

        } else {
            // TRƯỜNG HỢP 2: Xem bình thường (Không tìm kiếm -> query trực tiếp tối ưu phân trang)
            const [total, stories] = await Promise.all([
                Truyen.countDocuments(baseFilter),
                Truyen.find(baseFilter)
                    .populate('categories', 'name slug')
                    .select('-link -linkDrive -driveLink -shortCode')
                    .skip(skip)
                    .limit(limit)
                    .sort({ createdAt: -1, _id: -1 })
                    .lean()
            ]);

            totalStories = total;
            listTruyen = stories;
        }

        const totalPages = Math.ceil(totalStories / limit);

        // Phản hồi AJAX cho cuộn vô hạn
        if (req.query.type === 'json') {
            return res.json({ listTruyen, currentPage: page, totalPages, totalStories });
        }

        // Render giao diện SSR ban đầu
        res.render('index', {
            listTruyen,
            keyword: rawKeyword,
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