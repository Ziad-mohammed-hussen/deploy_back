const express = require("express");
const router = express.Router();

const { authenticate, authorizeAdmin } = require("../Middleware/adminMiddleware");

const {
  // Teachers
  createTeacher,
  updateTeacher,
  activateTeacher,
  deactivateTeacher,
  deleteTeacher,
  getAllTeachers,
  updateTeacherStatus,
  // Students
  updateStudent,
  deleteStudent,
  getAllStudents,
  // Courses
  updateCourse,
  approveCourse,
  rejectCourse,
  deleteCourse,
  getAllCourses,
  getPendingCourses,
  getCourseById,
  // Enrollments
  createEnrollment,
  deleteEnrollment,
  getAllEnrollments,
  // Dashboard & Lists
  getDashboard,
  // Sections & Content
  approveSection,
  getPendingSections,
  approveSectionContent,
  // Exams
  approveSectionExam,
  getPendingExams,
  rejectExam,
  getAllExams,
  // Reviews
  toggleReviewStatus,
  // Progress
  getAllProgress,
  getUserCourseProgress,
  updateProgress,
  // Payments
  getPayments,
// Reviews
getAllReviews
} = require("../controllers/adminController");

// كل الـ routes محتاجة admin مسجل دخول
router.use(authenticate, authorizeAdmin);

// ── Teachers ──────────────────────────────
router.post("/teachers",                  createTeacher);
router.put("/teachers/:id",               updateTeacher);
router.patch("/teachers/:id/activate",    activateTeacher);
router.patch("/teachers/:id/deactivate",  deactivateTeacher);
router.patch("/teachers/:id/status",      updateTeacherStatus);
router.delete("/teachers/:id",            deleteTeacher);
router.get("/teachers",                   getAllTeachers);

// ── Students ──────────────────────────────
router.put("/students/:id",               updateStudent);
router.delete("/students/:id",            deleteStudent);
router.get("/students",                   getAllStudents);

// ── Users (Common) ────────────────────────
router.patch("/users/:id/activate",       activateTeacher); // reuse teacher activation (affects User model)
router.patch("/users/:id/deactivate",     deactivateTeacher);

// ── Courses ───────────────────────────────
router.get("/courses",                    getAllCourses);
router.get("/courses/pending",            getPendingCourses);
router.get("/courses/:id",                getCourseById);
router.put("/courses/:id",                updateCourse);
router.patch("/courses/:id/approve",      approveCourse);
router.patch("/courses/:id/reject",       rejectCourse);
router.delete("/courses/:id",             deleteCourse);

// Sections & Contents
router.get("/pending/sections",           getPendingSections);
router.patch('/courses/:courseId/sections/:sectionId/approve', approveSection);
router.patch('/courses/:courseId/sections/:sectionId/contents/:contentId/approve', approveSectionContent);

// ── Exams ───────────────────────────────
router.get("/exams",                      getAllExams);
router.get('/pending-exams',              getPendingExams);
router.patch('/courses/:courseId/sections/:sectionId/exams/:examId/approve', approveSectionExam);
router.patch('/exams/:examId/reject',     rejectExam);

// ── Enrollments ───────────────────────────
router.get("/enrollments",                getAllEnrollments);
router.post("/enrollments",               createEnrollment);
router.delete("/enrollments/:id",         deleteEnrollment);

// ── Reviews ───────────────────────────
router.patch("/reviews/:id/toggle",       toggleReviewStatus);

// ── Progress ───────────────────────────
router.get("/progress",                   getAllProgress);
router.get("/progress/:userId/:courseId", getUserCourseProgress);
router.patch("/progress/:userId/:courseId", updateProgress);

// ── Dashboard ─────────────────────
router.get("/dashboard",                  getDashboard);

//
router.get("/payments", getPayments);

router.get("/reviews", getAllReviews);

module.exports = router;