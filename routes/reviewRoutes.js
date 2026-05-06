const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const adminController = require("../controllers/adminController");

// ⚡ التعديل هنا: لازم تطلب authorizeAdmin من الميدل وير عشان السيرفر يشوفها
const { authenticate, authorizeAdmin } = require('../middleware/adminMiddleware'); 

// روت للأدمن فقط لتغيير حالة التقييم
// دلوقتي authorizeAdmin بقت معرفة والسيرفر هيقوم عادي
router.patch('/feature/:reviewId', authenticate, authorizeAdmin, adminController.toggleReviewStatus);

// بقية الروتس...
router.post('/add', authenticate, reviewController.addReview);
router.get('/platform', reviewController.getPlatformReviews);
router.get('/course/:courseId', reviewController.getCourseReviews);

module.exports = router;