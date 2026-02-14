const Category = require('../models/Category');
const Truyen = require('../models/Truyen');

// Hàm tạo slug (Tiên Hiệp -> tien-hiep)
function toSlug(str) {
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/^-+|-+$/g, '');
}

// 1. Danh sách danh mục
exports.getList = async (req, res) => {
    try {
        // Lấy danh sách kèm số lượng truyện trong mỗi loại
        const categories = await Category.aggregate([
            {
                $lookup: {
                    from: 'truyens',
                    localField: '_id',
                    foreignField: 'categories',
                    as: 'stories'
                }
            },
            {
                $project: {
                    name: 1, slug: 1, description: 1,
                    storyCount: { $size: '$stories' } // Đếm số truyện
                }
            }
        ]);
        res.render('admin/category-list', { categories });
    } catch (err) { res.send('Lỗi: ' + err.message); }
};

// 2. Trang Thêm/Sửa
exports.getForm = async (req, res) => {
    try {
        let category = null;
        let selectedStoryIds = [];

        // Nếu là sửa -> Lấy thông tin category
        if (req.params.id) {
            category = await Category.findById(req.params.id);
            // Lấy danh sách ID các truyện đang thuộc category này
            const storiesInCategory = await Truyen.find({ categories: req.params.id }).select('_id');
            selectedStoryIds = storiesInCategory.map(s => s._id.toString());
        }

        // Lấy TOÀN BỘ truyện để hiển thị cho user chọn
        const allStories = await Truyen.find({ isDeleted: false }).select('name _id').sort({ createdAt: -1 });

        res.render('admin/category-form', { category, allStories, selectedStoryIds });
    } catch (err) { res.send('Lỗi: ' + err.message); }
};

// 3. Xử lý Lưu (Thêm mới hoặc Cập nhật)
exports.saveCategory = async (req, res) => {
    try {
        const { name, description, storyIds } = req.body; // storyIds là mảng ID truyện được chọn
        const slug = toSlug(name);
        let category;

        if (req.params.id) {
            // --- CẬP NHẬT ---
            category = await Category.findByIdAndUpdate(req.params.id, { name, slug, description }, { new: true });
            
            // XỬ LÝ LOGIC: "Trong mục sửa danh mục có phần thêm truyện"
            // 1. Bỏ category này khỏi TẤT CẢ truyện trước (Reset)
            await Truyen.updateMany({ categories: category._id }, { $pull: { categories: category._id } });
            
            // 2. Thêm category này vào các truyện ĐƯỢC CHỌN
            if (storyIds) {
                await Truyen.updateMany({ _id: { $in: storyIds } }, { $push: { categories: category._id } });
            }

        } else {
            // --- THÊM MỚI ---
            category = await Category.create({ name, slug, description });
            
            // Nếu lúc tạo mới có chọn truyện luôn
            if (storyIds) {
                await Truyen.updateMany({ _id: { $in: storyIds } }, { $push: { categories: category._id } });
            }
        }

        res.redirect('/admin/categories');
    } catch (err) { res.send('Lỗi: ' + err.message); }
};

// 4. Xóa danh mục
exports.deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        // Xóa ID category khỏi các truyện liên quan
        await Truyen.updateMany({ categories: req.params.id }, { $pull: { categories: req.params.id } });
        res.redirect('/admin/categories');
    } catch (err) { res.send('Lỗi xóa'); }
};