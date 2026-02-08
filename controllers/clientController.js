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
    const chunkSize = 10;
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