const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true }, // Dùng để làm link (vd: /the-loai/tien-hiep)
    description: String
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);