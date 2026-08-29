const Truyen = require('../models/Truyen');
const Category = require('../models/Category'); 
const Order = require('../models/Order'); // Model lưu giỏ hàng
const mongoose = require('mongoose');

// Hàm chuẩn hóa tiếng Việt & ký tự đặc biệt
// ==========================================
// 1. CÁC HÀM XỬ LÝ CHUỖI & TÍNH ĐIỂM
// ==========================================

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

function getAcronym(str) {
    const clean = normalizeText(str);
    if (!clean) return '';
    return clean.split(' ').map(w => w[0]).join('');
}

// Tính khoảng cách ký tự (bắt lỗi 'phongg' vs 'phong')
function levenshteinDistance(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function wordSimilarity(w1, w2) {
    if (w1 === w2) return 1.0;
    const maxLen = Math.max(w1.length, w2.length);
    if (maxLen === 0) return 1.0;
    return 1 - (levenshteinDistance(w1, w2) / maxLen);
}

// Tính điểm khớp giữa Query và Tên truyện
function calculateMatchScore(targetText, queryText) {
    if (!targetText || !queryText) return 0;
    
    // 1. Khớp chính xác tuyệt đối
    if (targetText === queryText) return 100;
    
    // 2. Chứa toàn bộ chuỗi của nhau (vd: query dài chứa tên truyện hoặc ngược lại)
    if (queryText.includes(targetText)) return 95;
    if (targetText.includes(queryText)) return 90;

    const targetTokens = targetText.split(' ').filter(w => w.length > 1);
    const queryTokens = queryText.split(' ').filter(w => w.length > 1);

    if (targetTokens.length === 0 || queryTokens.length === 0) return 0;

    let matchedCount = 0;
    let totalScore = 0;

    for (const qToken of queryTokens) {
        let maxSim = 0;
        for (const tToken of targetTokens) {
            const sim = wordSimilarity(qToken, tToken);
            if (sim > maxSim) maxSim = sim;
        }

        // Khớp từ nếu giống >= 70% (bắt được 'phongg' và 'phong')
        if (maxSim >= 0.7) {
            matchedCount++;
            totalScore += maxSim;
        }
    }

    if (matchedCount === 0) return 0;

    // Tỉ lệ từ trong tên truyện xuất hiện trong query
    const targetCoverage = matchedCount / targetTokens.length;
    const queryCoverage = matchedCount / queryTokens.length;

    // Nếu tên truyện có 8 từ mà trong ô tìm kiếm có 5-6 từ khớp -> Điểm rất cao
    if (targetCoverage >= 0.6) {
        return 70 + (targetCoverage * 25);
    }

    if (queryCoverage >= 0.6) {
        return 60 + (queryCoverage * 20);
    }

    // Nếu chỉ trùng 1 vài từ lẻ tẻ
    return (matchedCount / Math.max(targetTokens.length, queryTokens.length)) * 50;
}


// ==========================================
// 2. CONTROLLER TÌM KIẾM HOÀN CHỈNH
// ==========================================

exports.getHomePage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 16;
        const skip = (page - 1) * limit;

        const rawKeyword = (req.query.q || req.query.keyword || '').trim();
        const catSlug = req.query.cat || '';

        const [allCategories, listHot] = await Promise.all([
            Category.find(),
            Truyen.find({ isHot: true, isDeleted: false })
                .select('name title tenTruyen image hinhAnh totalChapters price gia')
                .sort({ updatedAt: -1 })
                .limit(10)
                .lean()
        ]);

        let baseFilter = { isDeleted: false };
        if (catSlug) {
            const currentCat = await Category.findOne({ slug: catSlug });
            if (currentCat) baseFilter.categories = currentCat._id;
        }

        let listTruyen = [];
        let totalStories = 0;

        if (rawKeyword) {
            // Chuẩn hóa từ khóa tìm kiếm
            const normalizedKey = normalizeText(rawKeyword);
            const compactKey = normalizedKey.replace(/\s+/g, '');

            // Lấy danh sách truyện từ DB (Chỉ lấy các trường cần thiết để nhẹ RAM)
            const candidateStories = await Truyen.find(baseFilter)
                .populate('categories', 'name slug')
                .select('name title tenTruyen author tacGia shortCode slug image hinhAnh totalChapters price gia')
                .lean();

            const scoredResults = [];

            for (const story of candidateStories) {
                const rawName = story.name || story.tenTruyen || story.title || '';
                const rawAuthor = story.author || story.tacGia || '';
                const customShortCode = story.shortCode || '';

                const normName = normalizeText(rawName);
                const normAuthor = normalizeText(rawAuthor);
                const acronym = getAcronym(rawName);

                let score = 0;

                // 1. So khớp tên truyện (Fuzzy + Phủ từ)
                const nameScore = calculateMatchScore(normName, normalizedKey);
                score = Math.max(score, nameScore);

                // 2. So khớp từ viết tắt (Acronym / Shortcode)
                if (customShortCode && normalizeText(customShortCode) === compactKey) {
                    score = Math.max(score, 95);
                } else if (acronym === compactKey) {
                    score = Math.max(score, 90);
                } else if (acronym && compactKey.length >= 2 && acronym.includes(compactKey)) {
                    score = Math.max(score, 60);
                }

                // 3. So khớp tác giả
                if (normAuthor && (normAuthor.includes(normalizedKey) || normalizedKey.includes(normAuthor))) {
                    score = Math.max(score, 65);
                }

                // CHẶN RÁC: Chỉ lấy truyện có điểm >= 35
                if (score >= 35) {
                    scoredResults.push({ story, score });
                }
            }

            // Sắp xếp truyện có điểm cao nhất lên đầu
            scoredResults.sort((a, b) => b.score - a.score);

            totalStories = scoredResults.length;
            listTruyen = scoredResults.slice(skip, skip + limit).map(item => item.story);

        } else {
            // Không tìm kiếm -> Phân trang bình thường
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

        if (req.query.type === 'json') {
            return res.json({ listTruyen, currentPage: page, totalPages, totalStories });
        }

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