const Truyen = require('../models/Truyen');
const Category = require('../models/Category'); // Model Danh mục mới thêm
const mongoose = require('mongoose');
const crypto = require('crypto'); // Dùng cho thanh toán

// 1. Trang chủ + Tìm kiếm + Lọc theo Danh mục
exports.getHomePage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        
        const keyword = req.query.q || ''; 
        const catSlug = req.query.cat || ''; // Lấy slug danh mục từ URL

        // Lấy danh sách Categories để hiển thị menu
        const allCategories = await Category.find(); 

        // Xây dựng bộ lọc
        let filter = { isDeleted: false }; // Mặc định: Chỉ lấy truyện CHƯA xóa

        // Nếu có chọn danh mục
        let currentCat = null;
        if (catSlug) {
            currentCat = await Category.findOne({ slug: catSlug });
            if (currentCat) {
                filter.categories = currentCat._id; // Lọc truyện theo ID danh mục
            }
        }

        // Nếu có tìm kiếm
        if (keyword) {
            filter = {
                $and: [
                    filter, // Giữ điều kiện cũ (xóa mềm + danh mục)
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
            .populate('categories', 'name slug') // Lấy tên danh mục để hiển thị (nếu cần)
            .select('-link -price -shortCode')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        if (req.query.type === 'json') {
            return res.json({ listTruyen, currentPage: page, totalPages, totalStories });
        }

        res.render('index', { 
            listTruyen, 
            keyword, 
            currentPage: page, 
            totalPages,
            allCategories,      // Truyền menu danh mục ra view
            currentCatSlug: catSlug // Để highlight menu active
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

// 3. Trang thanh toán (Hiển thị form/QR)
exports.getPayment = async (req, res) => {
    const { truyenId, partCode } = req.query;
    if (!mongoose.Types.ObjectId.isValid(truyenId)) return res.redirect('/');
    
    const truyen = await Truyen.findById(truyenId);
    const [start, end] = partCode.split('-').map(Number);

    const chapterCount = end - start + 1;
    const pricePerChapter = truyen.price || 1000;
    const totalAmount = chapterCount * pricePerChapter;
    
    const tapText = `${start}I${end}`; // Định dạng tập cho nội dung CK

    res.render('payment', { 
        truyenName: truyen.name, 
        shortCode: truyen.shortCode,
        partCode: partCode,
        tapText: tapText,
        amount: totalAmount, 
        amountText: totalAmount.toLocaleString('vi-VN') 
    });
};

// 4. API Tạo Link Thanh Toán (PayOS)
exports.createPaymentLink = async (req, res) => {
    try {
        const { email, amount, storyCode, tapText, returnUrl } = req.body;
        
        if (!email || !amount) return res.status(400).json({ error: "Thiếu thông tin" });

        // Xử lý dữ liệu
        let userPart = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const cleanCode = storyCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanTap = tapText.replace(/Tập/gi, '').replace(/\s/g, '').replace(/-/g, 'I');

        // Tạo nội dung chuyển khoản ngắn gọn
        let description = `${userPart} ${cleanCode} ${cleanTap}`;
        description = description.substring(0, 25); 

        const itemName = `${cleanCode} ${cleanTap}`;

        // PayOS Config
        const orderCode = Number(String(Date.now()).slice(-6));
        const finalAmount = Number(amount);
        const finalReturnUrl = returnUrl || `http://localhost:3000/`;
        const finalCancelUrl = returnUrl || `http://localhost:3000/`;

        // Tạo chữ ký
        const signatureString = `amount=${finalAmount}&cancelUrl=${finalCancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${finalReturnUrl}`;
        const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
        const signature = crypto.createHmac('sha256', checksumKey).update(signatureString).digest('hex');

        // Body gửi đi
        const bodyData = {
            orderCode: orderCode,
            amount: finalAmount,
            description: description,
            buyerName: userPart,
            buyerEmail: email,
            cancelUrl: finalCancelUrl,
            returnUrl: finalReturnUrl,
            signature: signature,
            items: [
                {
                    name: itemName,
                    quantity: 1,
                    price: finalAmount,
                },
            ],
        };

        // Gọi API PayOS
        const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': process.env.PAYOS_CLIENT_ID,
                'x-api-key': process.env.PAYOS_API_KEY
            },
            body: JSON.stringify(bodyData)
        });

        const result = await response.json();

        if (!response.ok || result.code !== "00") {
            return res.json({ error: result.desc || "Lỗi PayOS", useManualQR: true });
        }

        res.json({ checkoutUrl: result.data.checkoutUrl });

    } catch (error) {
        console.error("Lỗi:", error);
        res.json({ error: error.message, useManualQR: true });
    }
};