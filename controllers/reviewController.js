const mongoose = require('mongoose'); // ✅ لازم تزيد السطر ده
const Review = require('../models/Review');
const Course = require('../models/Course');

exports.addReview = async (req, res) => {
    try {
        const { courseId, rating, comment } = req.body;
        const studentId = req.user.id; // جاية من الـ authenticate middleware

        // 1. حفظ التقييم (تأكد إن اسم الحقل studentId مطابق للموديل بتاعك)
        const review = await Review.create({
            studentId, 
            courseId: courseId || null, 
            rating,
            comment
        });

        // 2. لو التقييم لكورس، نحدث "متوسط النجوم"
        if (courseId) {
            const stats = await Review.aggregate([
                { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
                { $group: { 
                    _id: '$courseId', 
                    avgRating: { $avg: '$rating' }, 
                    total: { $sum: 1 } 
                } }
            ]);

            if (stats.length > 0) {
                await Course.findByIdAndUpdate(courseId, {
                    averageRating: stats[0].avgRating.toFixed(1),
                    numberOfReviews: stats[0].total
                });
            }
        }

        res.status(201).json({ message: "شكراً لتقييمك!", review });
    } catch (error) {
        console.error("💥 Review Error:", error);
        if (error.code === 11000) return res.status(400).json({ message: "لقد قيمت هذا بالفعل" });
        res.status(500).json({ message: error.message });
    }
};

// 3. دالة جلب "آراء العملاء" للمنصة (التعليقات المميزة فقط)
exports.getPlatformReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ 
            courseId: null, 
            isFeatured: true 
        }).populate('studentId', 'name'); // عشان يظهر اسم الطالب
        
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// 4. دالة جلب تقييمات كورس معين
exports.getCourseReviews = async (req, res) => {
    try {
        const { courseId } = req.params;
        const reviews = await Review.find({ courseId })
            .populate('studentId', 'name') // بيجيب اسم الطالب من جدول الـ Users
            .sort({ createdAt: -1 }); // بيجيب أحدث التقييمات الأول

        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ message: "Error fetching reviews", error: error.message });
    }
};