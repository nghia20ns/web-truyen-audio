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
exports.createPaymentLink = async (req, res) => {
    try {
        const { email, amount, storyCode, tapText, returnUrl } = req.body;
        
        if (!email || !amount) return res.status(400).json({ error: "Thiếu thông tin" });

        // 1. TẠO NỘI DUNG CHUYỂN KHOẢN (Description)
        // Logic: Lấy tên user, ghép với mã truyện và tập -> Xóa ký tự đặc biệt -> Cắt ngắn < 25 ký tự
        let userPart = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        let cleanCode = storyCode.replace(/[^a-zA-Z0-9]/g, '');
        let cleanTap = tapText.replace(/[^a-zA-Z0-9]/g, '');

        // Kết quả: "nghiavo GIFATUI 1I10"
        let description = `${userPart} ${cleanCode} ${cleanTap}`;
        description = description.substring(0, 25); // Cắt ngắn để không lỗi PayOS

        // 2. CHUẨN BỊ DỮ LIỆU
        const orderCode = Number(String(Date.now()).slice(-6));
        const finalAmount = Number(amount);
        const finalReturnUrl = returnUrl || `http://localhost:3000/`;
        const finalCancelUrl = returnUrl || `http://localhost:3000/`;

        // 3. TẠO CHỮ KÝ (SIGNATURE)
        // Quy tắc PayOS: Sắp xếp a-z các trường: amount, cancelUrl, description, orderCode, returnUrl
        const signatureString = `amount=${finalAmount}&cancelUrl=${finalCancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${finalReturnUrl}`;

        const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
        if (!checksumKey) throw new Error("Chưa cấu hình PAYOS_CHECKSUM_KEY trong .env");

        const signature = crypto.createHmac('sha256', checksumKey)
            .update(signatureString)
            .digest('hex');

        // 4. TẠO BODY ĐẦY ĐỦ
        const bodyData = {
            orderCode: orderCode,
            amount: finalAmount,
            description: description,
            buyerName: userPart,
            buyerEmail: email,
            cancelUrl: finalCancelUrl,
            returnUrl: finalReturnUrl,
            signature: signature, // Đã có chữ ký xịn
            items: [
                {
                    name: `Truyen ${cleanCode} - ${cleanTap}`,
                    quantity: 1,
                    price: finalAmount,
                },
            ],
        };

        // 5. GỌI API PAYOS
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

        // 6. TRẢ VỀ KẾT QUẢ
        if (!response.ok || result.code !== "00") {
            console.error("Lỗi PayOS:", result);
            return res.status(500).json({ error: result.desc || "Lỗi tạo link thanh toán" });
        }

        res.json({ checkoutUrl: result.data.checkoutUrl });

    } catch (error) {
        console.error("Lỗi hệ thống:", error);
        res.status(500).json({ error: error.message });
    }
};