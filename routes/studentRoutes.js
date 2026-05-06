const express = require("express");
const router = express.Router();

// 1. استيراد الـ Middleware بشكل صحيح (Object Destructuring)
const { authenticate } = require('../middleware/adminMiddleware')
const courseController = require('../controllers/course'); 
const contentController = require('../controllers/content'); 


const {
  enrollCourse,
  getMyCourses,
  getCourseDetails,
  completeContent,
  submitExam,
  studentDashboard,
  changePassword,
   getFinalExam,migrateOldData
} = require("../controllers/studentController");

// 2. استخدام authenticate بدل كلمة auth
router.post("/enroll/:courseId", authenticate, enrollCourse);
router.get("/my-courses", authenticate, getMyCourses);
router.get("/course/:courseId", authenticate, getCourseDetails);
router.post("/content/:contentId/complete", authenticate, completeContent);
router.post("/exam/:examId/submit", authenticate, submitExam);
router.get("/dashboard", authenticate, studentDashboard);
router.patch("/change-password", authenticate, changePassword);
router.get('/:courseId/final-exam', authenticate, getFinalExam);
router.post('/courses/:courseId/sections/:sectionId/exam/evaluate', authenticate, contentController.submitSectionExam);
// تحديث تقدم الطالب (إكمال الدرس)
router.put('/courses/:courseId/sections/:sectionId/lessons/:lessonId/complete', authenticate, contentController.completeLesson);

module.exports = router;