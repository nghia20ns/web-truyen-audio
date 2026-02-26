const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
    cartId: { type: String, required: true, unique: true },

    email: { type: String, required: true },

    truyenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Truyen', required: false },

    selectedParts: [{ type: String }],

    totalAmount: { type: Number, required: true },

    // Thêm trường này để lưu vết thao tác của Admin

    isProcessed: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now }

});



module.exports = mongoose.model('Order', orderSchema);

