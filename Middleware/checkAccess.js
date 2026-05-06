const User = require('../models/User');
const Enrollment = require('../models/Enrollment');

const checkChatAccess = async (req, res, next) => {
    try {
        const userId = req.headers['user-id']; // هنبعته يدوي في الـ Header دلوقتي
        const { courseId } = req.body;

        if (!userId) return res.status(401).json({ message: "UserId is required in headers" });

        // 1. هل المستخدم موجود أصلاً؟
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // 2. لو هو Admin أو هو المدرس (Teacher) بتاع الكورس ده -> عدي
        if (user.role === 'admin') return next();

        // 3. لو طالب، هل هو مشترك في الكورس ده؟
        const enrollment = await Enrollment.findOne({ studentId: userId, courseId: courseId });
        if (!enrollment && user.role === 'student') {
            return res.status(403).json({ message: "You are not enrolled in this course" });
        }

        req.user = user; // بنخزن بياناته عشان نستخدمها بعدين
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = checkChatAccess;