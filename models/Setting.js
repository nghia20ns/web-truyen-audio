// models/Setting.js
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // Ví dụ: 'chat_status'
    value: { type: Boolean, default: true }              // true = Online, false = Offline
});

module.exports = mongoose.model('Setting', settingSchema);