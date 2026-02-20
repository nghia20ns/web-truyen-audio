const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    cartId: { type: String, required: true, unique: true }, // Mã 6 số ngẫu nhiên
    email: { type: String, required: true },
    truyenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Truyen', required: true },
    selectedParts: [{ type: String }], // Mảng lưu các tập đã chọn, vd: ["1-10", "11-20"]
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'pending' }, // pending (chưa thanh toán), completed (đã thanh toán)
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);