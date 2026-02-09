const Truyen = require('../models/Truyen');
const mongoose = require('mongoose');

// Trang chủ + Tìm kiếm
exports.getHomePage = async (req, res) => {
    try {
        // 1. MẶC ĐỊNH: Chỉ lấy những truyện CHƯA bị xóa mềm
        let filter = { isDeleted: false }; 
        
        const keyword = req.query.q || ''; 
        
        // 2. NẾU CÓ TÌM KIẾM:
        if (keyword) {
            filter = {
                $and: [
                    { isDeleted: false }, // Điều kiện bắt buộc: Phải chưa xóa
                    { 
                        $or: [ // Và thỏa mãn 1 trong 2 điều kiện tìm kiếm
                            { name: { $regex: keyword, $options: 'i' } },
                            { introduction: { $regex: keyword, $options: 'i' } },
                        ]
                    }
                ]
            };
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        // Đếm số lượng (chỉ đếm truyện chưa xóa)
        const totalStories = await Truyen.countDocuments(filter);
        const totalPages = Math.ceil(totalStories / limit);

        // Lấy danh sách (chỉ lấy truyện chưa xóa)
        const listTruyen = await Truyen.find(filter)
            .select('-link -price -shortCode')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        if (req.query.type === 'json') {
            return res.json({ listTruyen, currentPage: page, totalPages, totalStories });
        }

        res.render('index', { listTruyen, keyword, currentPage: page, totalPages }); 

    } catch (e) {
        console.error(e);
        res.status(500).send("Lỗi Server: " + e.message);
    }
};
// Chi tiết truyện
exports.getTruyenDetail = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.send("Lỗi ID");
    
    const truyen = await Truyen.findOne({ _id: req.params.id, isDeleted: false });
    if (!truyen) return res.send('Không tìm thấy');

    let parts = [];

    // --- SỬA Ở ĐÂY: Lấy chunk size từ DB ---
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
// Trang thanh toán
exports.getPayment = async (req, res) => {
    const { truyenId, partCode } = req.query;
    if (!mongoose.Types.ObjectId.isValid(truyenId)) return res.redirect('/');
    
    const truyen = await Truyen.findById(truyenId);
    const [start, end] = partCode.split('-').map(Number);

    const chapterCount = end - start + 1;
    const pricePerChapter = truyen.price || 1000;
    const totalAmount = chapterCount * pricePerChapter;
    
    // Logic riêng của bạn: đổi dấu gạch ngang thành chữ I hoặc theo ý muốn
    const tapText = `${start}I${end}`;

    res.render('payment', { 
        truyenName: truyen.name, 
        shortCode: truyen.shortCode,
        partCode: partCode,
        tapText: tapText,
        amount: totalAmount, 
        amountText: totalAmount.toLocaleString('vi-VN') 
    });
};

// Thêm dòng này lên đầu file clientController.js
const crypto = require('crypto'); 
// ... giữ nguyên các đoạn import Truyen, mongoose cũ ...

// ... giữ nguyên các hàm getHomePage, getTruyenDetail ...

// --- HÀM TẠO LINK THANH TOÁN (THỦ CÔNG, KHÔNG CẦN LIB PAYOS) ---
// controllers/clientController.js

exports.createPaymentLink = async (req, res) => {
    try {
        const { email, amount, storyCode, tapText, returnUrl } = req.body;
        
        if (!email || !amount) return res.status(400).json({ error: "Thiếu thông tin" });

        // --- 1. XỬ LÝ DỮ LIỆU ---
        
        // A. Xử lý Gmail: Lấy phần tên, bỏ đuôi @gmail.com, xóa ký tự lạ
        let userPart = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        // Giới hạn Gmail 10 ký tự để nhường chỗ cho Mã và Tập
        // B. Xử lý Mã truyện: Viết hoa, xóa ký tự lạ
        const cleanCode = storyCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        // C. Xử lý Tập: Chuyển "Tập 1 - 10" thành "1I10" (Số I Số)
        // Logic: Xóa chữ "Tập", xóa khoảng trắng, thay dấu "-" thành chữ "I"
        const cleanTap = tapText.replace(/Tập/gi, '').replace(/\s/g, '').replace(/-/g, 'I');

        // --- 2. TẠO NỘI DUNG ---

        // Nội dung CK: "quocnghia FATUICU 1I10" (Tối đa 25 ký tự)
        let description = `${userPart} ${cleanCode} ${cleanTap}`;
        description = description.substring(0, 25); // Cắt chốt chặn cuối cùng

        // Tên sản phẩm trong đơn hàng: "FATUICU 1I10"
        const itemName = `${cleanCode} ${cleanTap}`;

        // --- 3. CHUẨN BỊ GỬI PAYOS ---
        const orderCode = Number(String(Date.now()).slice(-6));
        const finalAmount = Number(amount);
        const finalReturnUrl = returnUrl || `http://localhost:3000/`;
        const finalCancelUrl = returnUrl || `http://localhost:3000/`;

        // Tạo chữ ký (Signature)
        const signatureString = `amount=${finalAmount}&cancelUrl=${finalCancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${finalReturnUrl}`;
        const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
        const signature = crypto.createHmac('sha256', checksumKey).update(signatureString).digest('hex');

        // Body gửi đi
        const bodyData = {
            orderCode: orderCode,
            amount: finalAmount,
            description: description, // <--- Đã chuẩn theo ý bạn (Gmail trước)
            buyerName: userPart,
            buyerEmail: email,
            cancelUrl: finalCancelUrl,
            returnUrl: finalReturnUrl,
            signature: signature,
            items: [
                {
                    name: itemName, // <--- Đã chuẩn theo ý bạn (Code + 1I10)
                    quantity: 1,
                    price: finalAmount,
                },
            ],
        };

        // Gọi API
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