const User = require("../models/User");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Exam = require("../models/Exam");
const Content = require("../models/Content");
const Review = require("../models/Review");
const Progress = require("../models/Progress");

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const sendSuccess = (res, data, message = "Success", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const sendError = (res, message = "Something went wrong", statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });


// ═══════════════════════════════════════════════════════════════
//  TEACHERS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /admin/teachers
 * Create a new teacher account (User + Teacher profile)
 */
exports.createTeacher = async (req, res) => {
  try {
    const {
      email, password,
      firstName, lastName, jobTitle,
      location, phone, linkedinUrl, cvUrl,
      educationLevel, specialization, experienceYears,
      introVideoUrl, certifications
    } = req.body;

    const lowerEmail = email?.toLowerCase();
    const existingUser = await User.findOne({ email: lowerEmail });
    if (existingUser) return sendError(res, "Email already in use", 409);

    // 1. إنشاء حساب المستخدم أولاً
    const user = await User.create({
      email: lowerEmail,
      password,
      firstName,
      lastName,
      role: "teacher",
      isVerified: true,
      isActive: true
    });

    try {
      // 2. إنشاء ملف المدرس المرتبط بالحساب
      const teacher = await Teacher.create({
        userId: user._id,
        firstName,
        lastName,
        jobTitle,
        phone,
        linkedinUrl,
        cvUrl,
        educationLevel,
        specialization,
        experienceYears,
        introVideoUrl,
        certifications,
        status: "approved" // الأدمن هو اللي بيكريه، فيبقى approved فوراً
      });

      return sendSuccess(res, { user, teacher }, "Teacher created successfully", 201);
    } catch (teacherErr) {
      // لو فشل إنشاء البروفايل، نحذف حساب المستخدم اللي لسه عاملينه عشان ميبقاش فيه بيانات معلقة
      await User.findByIdAndDelete(user._id);
      console.error("Teacher Profile Creation Error:", teacherErr);
      return sendError(res, `Failed to create teacher profile: ${teacherErr.message}`);
    }
  } catch (err) {
    console.error("Create Teacher Error:", err);
    return sendError(res, err.message);
  }
};

/**
 * PUT /admin/teachers/:id
 * Update teacher profile fields
 */
exports.updateTeacher = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    // 1. تحديث بيانات المستخدم الأساسية (User)
    if (firstName || lastName) {
      await User.findByIdAndUpdate(req.params.id, { firstName, lastName });
    }

    // 2. تحديث بيانات الملف الشخصي (Teacher)
    const teacher = await Teacher.findOneAndUpdate(
      { userId: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("userId", "-password");

    if (!teacher) return sendError(res, "Teacher not found", 404);

    return sendSuccess(res, teacher, "Teacher updated successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * PATCH /admin/teachers/:id/activate
 * Set user isActive = true
 */
exports.activateTeacher = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select("-password");

    if (!user || user.role !== "teacher") return sendError(res, "Teacher not found", 404);

    return sendSuccess(res, user, "Teacher activated successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * PATCH /admin/teachers/:id/deactivate
 * Set user isActive = false
 */
exports.deactivateTeacher = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select("-password");

    if (!user || user.role !== "teacher") return sendError(res, "Teacher not found", 404);

    return sendSuccess(res, user, "Teacher deactivated successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * DELETE /admin/teachers/:id
 * Hard-delete teacher user + profile
 */
exports.deleteTeacher = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "teacher") return sendError(res, "Teacher not found", 404);

    await Teacher.findOneAndDelete({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);

    return sendSuccess(res, null, "Teacher deleted successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /admin/teachers
 * Paginated list of all teachers with their profiles
 */
exports.getAllTeachers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [teachers, total] = await Promise.all([
      Teacher.find()
        .populate("userId", "-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),

      Teacher.countDocuments()
    ]);

    // 🔥 أهم جزء هنا (توحيد الحالة)
    const formattedTeachers = teachers.map(t => {
      const teacher = t.toObject();

      return {
        ...teacher,

        // 🎯 الحالة النهائية الحقيقية
        status:
          teacher.userId?.isActive === false
            ? "inactive"
            : teacher.status // pending / approved / rejected
      };
    });

    return sendSuccess(res, {
      teachers: formattedTeachers,
      total,
      page,
      pages: Math.ceil(total / limit)
    });

  } catch (err) {
    return sendError(res, err.message);
  }
};


// ═══════════════════════════════════════════════════════════════
//  STUDENTS
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /admin/students/:id
 * Update student profile
 */
exports.updateStudent = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    // 1. تحديث بيانات المستخدم الأساسية (User)
    if (firstName || lastName) {
      await User.findByIdAndUpdate(req.params.id, { firstName, lastName });
    }

    // 2. تحديث بيانات ملف الطالب (Student)
    const student = await Student.findOneAndUpdate(
      { userId: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("userId", "-password");

    if (!student) return sendError(res, "Student not found", 404);

    return sendSuccess(res, student, "Student updated successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * DELETE /admin/students/:id
 * Hard-delete student user + profile
 */
exports.deleteStudent = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "student") return sendError(res, "Student not found", 404);

    await Student.findOneAndDelete({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);

    return sendSuccess(res, null, "Student deleted successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /admin/students
 * Paginated list of all students with their profiles
 */
exports.getAllStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find()
        .populate("userId", "-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Student.countDocuments()
    ]);

    return sendSuccess(res, { students, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return sendError(res, err.message);
  }
};


// ═══════════════════════════════════════════════════════════════
//  COURSES
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /admin/courses/:id
 * Update any course field
 */
exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("instructorId", "-password");

    if (!course || course.isDeleted) return sendError(res, "Course not found", 404);

    return sendSuccess(res, course, "Course updated successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * PATCH /admin/courses/:id/approve
 * Approve a pending course and publish it
 */
exports.approveCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { status: "approved", isPublished: true },
      { new: true }
    );

    if (!course || course.isDeleted) return sendError(res, "Course not found", 404);

    return sendSuccess(res, course, "Course approved and published");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * PATCH /admin/courses/:id/reject
 * Reject a pending course
 */
exports.rejectCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", isPublished: false },
      { new: true }
    );

    if (!course || course.isDeleted) return sendError(res, "Course not found", 404);

    return sendSuccess(res, course, "Course rejected");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * DELETE /admin/courses/:id
 * Soft-delete a course
 */
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, isPublished: false },
      { new: true }
    );

    if (!course) return sendError(res, "Course not found", 404);

    return sendSuccess(res, null, "Course deleted successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /admin/courses
 * Paginated list of all non-deleted courses
 */
exports.getAllCourses = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .populate("instructorId", "firstName lastName email")
        .select("-sections")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Course.countDocuments(filter)
    ]);

    return sendSuccess(res, { courses, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /admin/courses/pending
 * List all courses with status = pending
 */
exports.getPendingCourses = async (req, res) => {
  try {
    const courses = await Course.find({ status: "pending", isDeleted: false })
      .populate("instructorId", "firstName lastName email")
      .sort({ createdAt: 1 }); // oldest first so admin reviews in order

    return sendSuccess(res, courses);
  } catch (err) {
    return sendError(res, err.message);
  }
};
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    })
      .populate("instructorId", "firstName lastName email")
      .populate("finalExam", "title status");

    if (!course) return sendError(res, "Course not found", 404);

    return sendSuccess(res, course);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// ═══════════════════════════════════════════════════════════════
//  ENROLLMENTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /admin/enrollments
 * Manually enroll a student in a course
 */
exports.createEnrollment = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) return sendError(res, "studentId and courseId are required", 400);

    const [student, course] = await Promise.all([
      User.findById(studentId),
      Course.findById(courseId)
    ]);

    if (!student || student.role !== "student") return sendError(res, "Student not found", 404);
    if (!course || course.isDeleted) return sendError(res, "Course not found", 404);

    const existing = await Enrollment.findOne({ studentId, courseId });
    if (existing) return sendError(res, "Student is already enrolled in this course", 409);

    const enrollment = await Enrollment.create({
      studentId,
      courseId,
      status: "active"
    });

    // إنشاء سجل التقدم أيضاً
    await Progress.create({
      userId: studentId,
      courseId,
      completionPercentage: 0
    }).catch(() => {}); // نتجاهل لو السجل موجود أصلاً

    return sendSuccess(res, enrollment, "Enrollment created successfully", 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * DELETE /admin/enrollments/:id
 * Soft-delete an enrollment
 */
exports.deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

    if (!enrollment) return sendError(res, "Enrollment not found", 404);

    return sendSuccess(res, null, "Enrollment deleted successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /admin/enrollments
 * Paginated list of all enrollments
 */
exports.getAllEnrollments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.status) filter.status = req.query.status;

    const [enrollments, total] = await Promise.all([
      Enrollment.find(filter)
        .populate("studentId", "firstName lastName email")
        .populate("courseId", "title category price")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Enrollment.countDocuments(filter)
    ]);

    // نربط نسبة التقدم من موديل الـ Progress لكل اشتراك
    const enrollmentsWithProgress = await Promise.all(enrollments.map(async (e) => {
      const prog = await Progress.findOne({ userId: e.studentId?._id, courseId: e.courseId?._id });
      const obj = e.toObject();
      obj.progressPercentage = prog ? prog.completionPercentage : 0;
      return obj;
    }));

    return sendSuccess(res, { enrollments: enrollmentsWithProgress, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return sendError(res, err.message);
  }
};


// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/dashboard
 * Aggregate counts for the admin overview
 */
exports.getDashboard = async (req, res) => {
  try {
    const [
      totalStudents,
      totalTeachers,
      totalCourses,
      totalEnrollments,
      pendingCourses,
      pendingSections,
      pendingExams,
      pendingContent
    ] = await Promise.all([
      User.countDocuments({ role: "student", isActive: true }),
      User.countDocuments({ role: "teacher", isActive: true }),
      Course.countDocuments({ isDeleted: false }),
      Enrollment.countDocuments({ isDeleted: false }),
      Course.countDocuments({ status: "pending", isDeleted: false }),

      // Pending sections: courses that have at least one section with status=pending
      Course.countDocuments({
        isDeleted: false,
        "sections.status": "pending"
      }),

      Exam.countDocuments({ status: "pending", isDeleted: false }),
      Content.countDocuments({ status: "pending", isDeleted: false })
    ]);

    return sendSuccess(res, {
      totalStudents,
      totalTeachers,
      totalCourses,
      totalEnrollments,
      pendingCourses,
      pendingSections,
      pendingExams,
      pendingContent
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};


// ═══════════════════════════════════════════════════════════════
//  SECTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * PATCH /admin/courses/:courseId/sections/:sectionId/approve
 * Approve a single section inside a course
 */
exports.approveSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    const course = await Course.findOneAndUpdate(
      { _id: courseId, isDeleted: false, "sections._id": sectionId },
      { $set: { "sections.$.status": "approved" } },
      { new: true }
    );

    if (!course) return sendError(res, "Course or section not found", 404);

    const section = course.sections.id(sectionId);
    return sendSuccess(res, section, "Section approved successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /admin/sections/pending
 * Return all courses that contain at least one pending section
 */
exports.getPendingSections = async (req, res) => {
  try {
    const courses = await Course.find({
      isDeleted: false,
      "sections.status": "pending"
    }).select("title sections instructorId").populate("instructorId", "firstName lastName email");

    // Filter sections to only include pending ones
    const result = courses.map((course) => ({
      courseId: course._id,
      courseTitle: course.title,
      instructor: course.instructorId,
      pendingSections: course.sections.filter((s) => s.status === "pending")
    }));

    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * PATCH /admin/contents/:contentId/approve
 * Approve a single content item
 */
exports.approveSectionContent = async (req, res) => {
  try {
    const content = await Content.findByIdAndUpdate(
      req.params.contentId,
      { status: "approved" },
      { new: true }
    );

    if (!content || content.isDeleted) return sendError(res, "Content not found", 404);

    return sendSuccess(res, content, "Content approved successfully");
  } catch (err) {
    return sendError(res, err.message);
  }
};


// ═══════════════════════════════════════════════════════════════
//  EXAMS
// ═══════════════════════════════════════════════════════════════

/**
 * PATCH /admin/exams/:examId/approve
 * Approve and publish a section exam
 */
exports.approveSectionExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.examId,
      { status: "approved", isPublished: true },
      { new: true }
    );

    if (!exam || exam.isDeleted) return sendError(res, "Exam not found", 404);

    return sendSuccess(res, exam, "Exam approved and published");
  } catch (err) {
    return sendError(res, err.message);
  }
};

/**
 * GET /admin/exams/pending
 * List all pending exams
 */
exports.getPendingExams = async (req, res) => {
  try {
    const exams = await Exam.find({
      status: "pending",
      isDeleted: false
    })
      .populate("courseId", "title")
      .sort({ createdAt: 1 });

    return res.json({
      success: true,
      data: exams
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
// exports.rejectExam = async (req, res) => {
//   try {
//     const exam = await Exam.findByIdAndUpdate(
//       req.params.examId,
//       { status: "rejected", isPublished: false },
//       { new: true }
//     );

//     if (!exam || exam.isDeleted) return sendError(res, "Exam not found", 404);

//     return sendSuccess(res, exam, "Exam rejected");
//   } catch (err) {
//     return sendError(res, err.message);
//   }
// };
exports.rejectExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.examId,
      { status: "rejected", isPublished: false },
      { new: true }
    );
    if (!exam || exam.isDeleted) return sendError(res, "Exam not found", 404);
    return sendSuccess(res, exam, "Exam rejected");
  } catch (err) {
    return sendError(res, err.message);
  }
};
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find({ isDeleted: false })
      .populate("courseId")   // ← من غير تحديد fields، هيجيب كل حاجة
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: exams
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
//  REVIEWS
// ═══════════════════════════════════════════════════════════════

/**
 * PATCH /admin/reviews/:id/toggle
 * Toggle isFeatured flag on a review (show/hide on homepage)
 */
exports.toggleReviewStatus = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return sendError(res, "Review not found", 404);

    review.isFeatured = !review.isFeatured;
    await review.save();

    return sendSuccess(
      res,
      review,
      `Review ${review.isFeatured ? "featured" : "unfeatured"} successfully`
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("studentId", "firstName lastName email")
      .populate("courseId", "title")
      .sort({ createdAt: -1 });

    return sendSuccess(res, reviews);
  } catch (err) {
    return sendError(res, err.message);
  }
};
// ═══════════════════════════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════════════════════════
exports.getAllProgress = async (req, res) => {
  try {
    const progress = await Progress.find()
      .populate("userId", "firstName lastName email")
      .populate("courseId", "title");

    return sendSuccess(res, progress, "All progress fetched");
  } catch (err) {
    return sendError(res, err.message);
  }
};
exports.getUserCourseProgress = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const progress = await Progress.findOne({ userId, courseId })
      .populate("userId")
      .populate("courseId");

    if (!progress) return sendError(res, "Progress not found", 404);

    return sendSuccess(res, progress);
  } catch (err) {
    return sendError(res, err.message);
  }
};
exports.updateProgress = async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const { completionPercentage } = req.body;

    const progress = await Progress.findOneAndUpdate(
      { userId, courseId },
      { completionPercentage },
      { new: true }
    );

    if (!progress) return sendError(res, "Progress not found", 404);

    return sendSuccess(res, progress, "Progress updated");
  } catch (err) {
    return sendError(res, err.message);
  }
};
// ═══════════════════════════════════════════════════════════════
/**
 * PATCH /admin/teachers/:id/status
 * Change teacher status (pending / approved / rejected)
 */
exports.updateTeacherStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return sendError(res, "Invalid status", 400);
    }

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("userId", "-password");

    if (!teacher) return sendError(res, "Teacher not found", 404);

    return sendSuccess(res, teacher, `Teacher status updated to ${status}`);
  } catch (err) {
    return sendError(res, err.message);
  }
};
// ═══════════════════════════════════════════════════════════════
//  PAYMENTS
// ═══════════════════════════════════════════════════════════════

const Payment = require("../models/Payment");

/**
 * GET /admin/payments
 * Paginated list of all payments + totals
 */
exports.getPayments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [payments, total, totals] = await Promise.all([
      Payment.find({ status: "completed" })
        .populate("studentId", "firstName lastName email")
        .populate({
          path: "courseId",
          select: "title category instructorId",
          populate: {
            path: "instructorId",         // ← هيجيب المدرس من جوا الكورس
            select: "firstName lastName email"
          }
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),

      Payment.countDocuments({ status: "completed" }),

      Payment.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: "$courseId",             // ← مجمّع per course مش كل حاجة مع بعض
            totalRevenue:         { $sum: "$amount" },
            totalAdminShare:      { $sum: "$adminShare" },
            totalInstructorShare: { $sum: "$instructorShare" },
            paymentsCount:        { $sum: 1 }
          }
        }
      ])
    ]);

    // Summary إجمالي
    const summary = {
      totalRevenue:         totals.reduce((s, t) => s + t.totalRevenue, 0),
      totalAdminShare:      totals.reduce((s, t) => s + t.totalAdminShare, 0),
      totalInstructorShare: totals.reduce((s, t) => s + t.totalInstructorShare, 0),
    };

    return sendSuccess(res, {
      payments,
      total,
      page,
      pages: Math.ceil(total / limit),
      summary,
      perCourse: totals       // ← هيبيّن نصيب كل كورس لوحده
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};