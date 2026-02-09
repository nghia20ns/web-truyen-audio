// models/Admin.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true } // Lưu chuỗi mã hóa (Hash), không lưu text thường
});

module.exports = mongoose.model('Admin', adminSchema);