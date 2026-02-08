// models/ThongBao.js
const mongoose = require('mongoose');

const thongBaoSchema = new mongoose.Schema({
    content: { type: String, default: '' },      // Nội dung thông báo
    isOn: { type: Boolean, default: false },     // Bật/Tắt
    type: { type: String, default: 'warning' }   // Loại màu: warning (vàng), danger (đỏ), info (xanh)
});

module.exports = mongoose.model('ThongBao', thongBaoSchema);