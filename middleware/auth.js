module.exports = (req, res, next) => {
    // Nếu cookie không có adminId -> Đá về login
    if (!req.session || !req.session.adminId) {
        return res.redirect('/admin/login');
    }
    next();
};