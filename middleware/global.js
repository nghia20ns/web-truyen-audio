const ThongBao = require('../models/ThongBao');

const globalAlert = async (req, res, next) => {
    try {
        let thongBao = await ThongBao.findOne();
        if (!thongBao) {
            thongBao = await ThongBao.create({ content: 'Chào mừng đến Cat Audio', isOn: false });
        }
        res.locals.globalAlert = thongBao;
        next();
    } catch (err) {
        console.error("Lỗi lấy thông báo:", err);
        next();
    }
};
module.exports = globalAlert;