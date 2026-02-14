const mongoose = require('mongoose');

const truyenSchema = new mongoose.Schema({
    name: String,
    introduction: String,
    totalChapters: Number,
    link: String,
    shortCode: { type: String, unique: true, required: true },
    price: { type: Number, default: 1000 },
    isDeleted: { type: Boolean, default: false },   
    chunkSize: { type: Number, default: 10 },
    // --- THÊM DÒNG NÀY ---
    image: { type: String, default: '' },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }]
    // ---------------------
}, { timestamps: true });

module.exports = mongoose.model('Truyen', truyenSchema);