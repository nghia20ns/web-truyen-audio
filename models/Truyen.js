const mongoose = require('mongoose');

const truyenSchema = new mongoose.Schema({
    name: String,
    introduction: String,
    totalChapters: Number,
    link: String,
    shortCode: { type: String, unique: true, required: true },
    price: { type: Number, default: 1000 },
    isDeleted: { type: Boolean, default: false },   
    chunkSize: { type: Number, default: 10 } // Số tập trong 1 gói (VD: 10, 20, 50...)


}, { timestamps: true }); // Thêm timestamps để có createdAt, updatedAt

module.exports = mongoose.model('Truyen', truyenSchema);