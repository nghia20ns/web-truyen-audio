require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');
const globalAlertMiddleware = require('./middleware/global');

// 1. Kết nối Database
connectDB();

// 2. Cấu hình App
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

// 3. Middleware
app.use(globalAlertMiddleware); // Kích hoạt thông báo toàn web

// 4. Routes
app.use('/', require('./routes/index'));      // Routes cho khách
app.use('/admin', require('./routes/admin')); // Routes cho admin

// 5. Khởi động Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Web chạy tại: http://localhost:${PORT}`);
});