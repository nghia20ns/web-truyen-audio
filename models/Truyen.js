// models/Truyen.js
const mongoose = require('mongoose');

const truyenSchema = new mongoose.Schema({
    name: String,
    introduction: String,
    totalChapters: Number,
    link: {
        type: String,
        default: ''
    },
    linkYtb: {
        type: String,
        default: ''
    },  
    shortCode: { type: String, unique: true, required: true },
    price: { type: Number, default: 1000 },
    isDeleted: { type: Boolean, default: false },   
    chunkSize: { type: Number, default: 10 },
    // --- THÊM DÒNG NÀY ---
    publishedChapters: { type: Number, default: 0 }, // Số tập đã public miễn phí
    // ---------------------
    image: { type: String, default: '' },
    isHot: { type: Boolean, default: false },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }]
}, { timestamps: true });

module.exports = mongoose.model('Truyen', truyenSchema);