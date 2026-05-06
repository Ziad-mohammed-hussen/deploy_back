const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const Course = require("../models/Course");
const Exam = require("../models/Exam"); // تأكد إن المسار لملف الـ Exam صح
const bcrypt = require("bcrypt");
const Progress = require("../models/Progress");

// POST /student/enroll/:courseId
// Body (optional): { instructorId }
; // لازم تستدعي موديل الكورس هنا

exports.enrollCourse = async (req, res) => {
  try {
    const studentId = req.user && (req.user.id || req.user._id);
    const { courseId } = req.params;

    // 1️⃣ جلب بيانات الكورس أولاً للتأكد من حالته
    const targetCourse = await Course.findById(courseId);

    if (!targetCourse) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    // 🛡️ القفل الأول: منع الاشتراك تماماً لو الكورس لسه الإدارة مراجعتوش (Pending)
    // حتى لو الطالب معاه الـ ID، مش هيعرف يفتح "بوابة الدفع" إلا لما يبقا Approved
    if (targetCourse.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: "⏳ هذا الكورس تحت المراجعة من قبل الإدارة وسيتم نشره قريباً. تابعنا!" 
      });
    }

    // لو الكورس موافق عليه بس المدرس لسه مخليه UnPublished (مسودة)
    if (targetCourse.isPublished === false) {
        return res.status(403).json({ 
          success: false, 
          message: "هذا الكورس غير متاح للاشتراك حالياً." 
        });
    }

    // 2️⃣ التأكد من وجود اشتراك قديم للطالب
    const existingEnrollment = await Enrollment.findOne({ studentId, courseId });

    if (existingEnrollment) {
      // الحالة أ: الطالب دافع ومخلص أموره
      if (existingEnrollment.status === "active") {
        return res.status(409).json({ 
            success: false, 
            message: "أنت مشترك بالفعل في هذا الكورس ومتاح لك الوصول للمحتوى." 
        });
      }
      
      // الحالة ب: الطالب بدأ عملية الاشتراك بس لسه مدفعش (Pending)
      return res.status(200).json({ 
        success: true, 
        message: "لديك طلب اشتراك سابق، يرجى إتمام عملية الدفع لتفعيل الكورس.", 
        data: existingEnrollment 
      });
    }

    // 3️⃣ إنشاء اشتراك جديد (بداية السيكل)
    // لو الكورس مجاني، فعله علطول. لو بفلوس خليه Pending
    const isFree = targetCourse.price === 0;
    
    const enrollment = await Enrollment.create({
      studentId,
      courseId,
      status: isFree ? "active" : "pending", 
    });

    // 🚀 لو الكورس مجاني، بننشئ سجل تقدم للطالب فوراً عشان المحتوى يفتح
    if (isFree) {
      await Progress.findOneAndUpdate(
        { userId: studentId, courseId: courseId },
        { 
          userId: studentId, 
          courseId: courseId,
          completedLessons: [],
          completionPercentage: 0
        },
        { upsert: true, new: true }
      );
    }

    return res.status(201).json({
      success: true,
      isFree: isFree,
      message: isFree ? "تم الاشتراك في الكورس المجاني بنجاح! يمكنك البدء الآن." : "تم بدء طلب الاشتراك بنجاح. يرجى الانتقال لصفحة الدفع للتفعيل.",
      data: enrollment,
    });

  } catch (error) {
    console.error("❌ enrollCourse error:", error);
    
    // التعامل مع الـ Duplicate Key لو ضغط مرتين في نفس اللحظة
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "أنت مشترك بالفعل في هذا الكورس." });
    }
    
    return res.status(500).json({ success: false, message: "حدث خطأ داخلي، يرجى المحاولة لاحقاً." });
  }
};

// 2) دالة جلب كورسات الطالب (My Courses)
exports.getMyCourses = async (req, res) => {
  try {
    const studentId = req.user && (req.user.id || req.user._id);

    if (!studentId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    // 1️⃣ البحث عن اشتراكات الطالب النشطة فقط
    const enrollments = await Enrollment.find({ 
      studentId, 
      status: "active" 
    }).populate({
      path: "courseId",
      // 🛡️ القفل الحقيقي: بنقول للمونجوز "هات الكورس بس بشرط يكون approved"
      match: { status: "approved" }, 
      select: "-exams.questions.correctAnswer -sections.exam.questions.correctAnswer"
    });

    /** * 🧐 ملحوظة تقنية: 
     * لو الكورس حالته pending، الـ populate هيخلي الـ courseId يساوي null 
     * بسبب شرط الـ match اللي ضفناه فوق.
     */

    // 2️⃣ تصفية المصفوفة من أي كورس (null) بسبب عدم موافقة الأدمن
    const activeAndApprovedCourses = enrollments
      .filter((enrollment) => enrollment.courseId !== null) 
      .map((enrollment) => enrollment.courseId);

    // 🛑 كونسول لمتابعة السيكل
    console.log("-----------------------------------------");
    console.log(`👤 Student: ${studentId}`);
    console.log(`📚 Total Active Enrollments: ${enrollments.length}`);
    console.log(`✅ Visible Courses (Approved): ${activeAndApprovedCourses.length}`);
    console.log("-----------------------------------------");

    return res.status(200).json({
      success: true,
      message: "Fetched active enrolled courses successfully.",
      // هيرجع مصفوفة فاضية [] لو مفيش كورسات موافق عليها، وده الصح
      data: activeAndApprovedCourses, 
    });
  } catch (error) {
    console.error("❌ getMyCourses error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch enrolled courses." });
  }
};// GET /student/course/:courseId
exports.getCourseDetails = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.params;

    console.log("🔍 Fetching details for Course:", courseId);

    // 1️⃣ جلب الاشتراك وتفاصيل الكورس مع فلترة الإجابات الصحيحة للأمان
    const enrollment = await Enrollment.findOne({ studentId, courseId })
      .populate({
        path: "courseId",
        select: "-exams.questions.correctAnswer -sections.exam.questions.correctAnswer" 
      });

    // 2️⃣ القفل الأول: هل الطالب مشترك أصلاً وحالة دفعه نشطة؟
    if (!enrollment || enrollment.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "💳 الوصول مرفوض: يجب إتمام عملية الدفع أولاً لتتمكن من مشاهدة محتوى الكورس.",
      });
    }

    // 3️⃣ القفل الثاني والأهم: هل الأدمن موافق على الكورس حالياً؟
    // لو المدرس عدل الكورس وحالته رجعت Pending، الطالب هيتمنع هنا فوراً
    if (!enrollment.courseId || enrollment.courseId.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "🛠️ الكورس قيد التحديث المؤقت من قبل الإدارة. اشتراكك سليم وسيعود المحتوى للظهور فور انتهاء المراجعة.",
      });
    }

    // 🔥 كونسول الأمان للتأكد من اختفاء الإجابات الصحيحة
    if (enrollment.courseId.sections && enrollment.courseId.sections[0]) {
        const firstQuestion = enrollment.courseId.sections[0].exam?.questions?.[0];
        console.log("-----------------------------------------");
        console.log("🛑 Security Check - Question Fields:", firstQuestion ? Object.keys(firstQuestion.toObject()) : "Empty");
        console.log("-----------------------------------------");
    }

    // 4️⃣ لو عدي من كل الأبواب دي.. نبعت البيانات
    return res.status(200).json({
      success: true,
      message: "تم جلب تفاصيل الكورس بنجاح.",
      data: enrollment.courseId,
    });

  } catch (error) {
    console.error("❌ getCourseDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "فشل في جلب تفاصيل الكورس.",
    });
  }
};
// POST /student/content/:contentId/complete
// Body: { courseId, totalContents }
// POST /student/content/:contentId/complete


// POST /student/exam/:examId/submit
// Body: { courseId, answers, score }
// POST /student/exam/:examId/submit
// POST /student/exam/:examId/submit
exports.submitExam = async (req, res) => {
    try {
        const { examId } = req.params;
        const { courseId, answers } = req.body;
        const studentId = req.user.id;

        // 1. جلب الامتحان والتحقق من وجوده مع الإجابات الصحيحة
        const Exam = require("../models/Exam");
        const exam = await Exam.findById(examId).select("+questions.correctAnswerIndex");
        if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

        // 2. حساب النتيجة
        let scoreCount = 0;
        let totalPoints = 0;

        exam.questions.forEach((q, i) => {
            const points = q.grade || q.points || 1;
            totalPoints += points;
            if (answers && answers[i] === q.correctAnswerIndex) {
                scoreCount += points;
            }
        });

        const finalScore = totalPoints > 0 ? Math.round((scoreCount / totalPoints) * 100) : 0;
        const isPassed = finalScore >= (exam.passingScore || 50);

        // 3. تحديث سجل التقدم (Progress)
        const Progress = require("../models/Progress");
        const progress = await Progress.findOneAndUpdate(
            { userId: studentId, courseId },
            { 
                $push: { 
                    examResults: { 
                        examId, 
                        score: finalScore, 
                        status: isPassed ? 'passed' : 'failed' 
                    } 
                }
            },
            { upsert: true, new: true }
        );

        // 4. لو الامتحان ده نهائي (Final) ونجح، نطلع الشهادة ونقفل الكورس
        if (isPassed && exam.isFinal) {
            const Enrollment = require("../models/Enrollment");
            const enrollment = await Enrollment.findOne({ studentId, courseId });
            
            if (enrollment) {
                const Certificate = require("../models/Certificate");
                const serial = `CERT-${courseId.toString().slice(-4)}-${studentId.toString().slice(-4)}-${Date.now().toString().slice(-5)}`;
                
                await Certificate.findOneAndUpdate(
                    { studentId, courseId },
                    { 
                        enrollmentId: enrollment._id,
                        certificateSerial: serial, 
                        issueDate: new Date() 
                    },
                    { upsert: true }
                );

                progress.isCourseCompleted = true;
                await progress.save();

                enrollment.status = 'completed';
                enrollment.completionDate = new Date();
                await enrollment.save();
            }
        }

        return res.status(200).json({ 
            success: true, 
            score: finalScore, 
            passed: isPassed,
            message: isPassed ? "تهانينا! لقد اجتزت الاختبار." : "للأسف، لم تحقق درجة النجاح."
        });

    } catch (error) {
        console.error("❌ submitExam error:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
// GET /student/dashboard
exports.studentDashboard = async (req, res) => {
  try {
    const studentId = req.user && (req.user.id || req.user._id);

    console.log(`\n--- 📊 [START] Fetching Dashboard ---`);
    console.log(`👤 StudentID: ${studentId}`);

    if (!studentId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    // 1️⃣ جلب بيانات التقدم مع Populate
    const progressRecords = await Progress.find({ userId: studentId })
      .populate({
        path: 'courseId',
        select: 'title thumbnail status' 
      })
      .populate({
        path: 'lastAccessedContent',
        select: 'title' 
      });

    console.log(`📂 Found ${progressRecords.length} progress records in DB.`);

    // تصفية الكورسات الـ Approved فقط
    const validProgress = progressRecords.filter(p => p.courseId && p.courseId.status === 'approved');

    let totalCourses = validProgress.length;
    let completedCourses = 0;
    let totalScore = 0;
    let scoreCount = 0;
    let totalProgressSum = 0;
    let activeCourseCards = [];

    for (const p of validProgress) {
      let currentProgress = p.completionPercentage || 0;
      
      // لو النسبة صفر بس فيه دروس مخلصة، نحسبها تاني (احتياطي)
      if (currentProgress === 0 && p.completedContents?.length > 0) {
        const Course = require("../models/Course");
        const courseDoc = await Course.findById(p.courseId._id);
        if (courseDoc) {
          const totalItems = courseDoc.sections.reduce((acc, sec) => 
            acc + (sec.lessons?.length || 0) + (sec.contents?.length || 0), 0);
          
          if (totalItems > 0) {
            currentProgress = Math.round((p.completedContents.length / totalItems) * 100);
            p.completionPercentage = currentProgress;
            await p.save();
          }
        }
      }
      if (p.isCourseCompleted) {
        currentProgress = 100;
      }

      if (p.isCourseCompleted || currentProgress >= 100) {
        completedCourses += 1;
      }

      // إضافة لجمالى التقدم لحساب المتوسط لاحقاً
      totalProgressSum += currentProgress;

      // حساب متوسط الدرجات من الـ Progress model
      if (p.examResults && p.examResults.length > 0) {
        p.examResults.forEach((res) => {
          if (typeof res.score === 'number') {
            totalScore += res.score;
            scoreCount += 1;
          }
        });
      }

      // تجهيز الكروت
      // جلب بيانات الشهادة لو الكورس مخلص
      let certificate = null;
      if (p.isCourseCompleted || currentProgress >= 100) {
          const Certificate = require("../models/Certificate");
          certificate = await Certificate.findOne({ studentId: studentId, courseId: p.courseId._id });
          
          // 🔥 Backfill: لو مفيش شهادة والكورس مخلص، نكريتها دلوقتى
          if (!certificate) {
              const Enrollment = require("../models/Enrollment");
              const enrollment = await Enrollment.findOne({ studentId, courseId: p.courseId._id });
              
              if (enrollment) {
                  console.log(`🛠️ Backfilling certificate for Course: ${p.courseId._id} | Student: ${studentId}`);
                  const serial = `CERT-${p.courseId._id.toString().slice(-4)}-${studentId.toString().slice(-4)}-${Date.now().toString().slice(-5)}`;
                  certificate = await Certificate.create({
                      studentId: studentId,
                      courseId: p.courseId._id,
                      enrollmentId: enrollment._id,
                      certificateSerial: serial,
                      issueDate: new Date()
                  });
              }
          }
      }

      activeCourseCards.push({
        courseId: p.courseId._id,
        title: p.courseId.title,
        thumbnail: p.courseId.thumbnail,
        progress: currentProgress,
        completedLessons: p.completedContents || [],
        lastLesson: p.lastAccessedContent ? (p.lastAccessedContent.title?.ar || p.lastAccessedContent.title) : "لم يبدأ بعد",
        isCompleted: p.isCourseCompleted || (currentProgress >= 100),
        certificate: certificate
      });
    }

    // الحسابات النهائية للمنصة ككل
    const averageScore = scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(2)) : 0;
    const overallProgress = totalCourses > 0 ? Number((totalProgressSum / totalCourses).toFixed(2)) : 0;

    console.log(`🎯 Final Summary: Overall ${overallProgress}% | Avg Score: ${averageScore}% | Completed: ${completedCourses}/${totalCourses}`);
    console.log(`--- ✅ [END] Dashboard Processed ---\n`);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCourses,
          completedCourses,
          averageScore,
          overallProgress,
        },
        activeCourses: activeCourseCards,
      },
    });
  } catch (error) {
    console.error("❌ CRITICAL ERROR in studentDashboard:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch dashboard data.",
      error: error.message 
    });
  }
};


// ========== Get Final Exam Questions ========== //
 // GET /student/course/:courseId/final-exam
exports.getFinalExam = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user && (req.user.id || req.user._id);

    // 1️⃣ جلب الكورس والاشتراك
    const course = await Course.findById(courseId);
    const enrollment = await Enrollment.findOne({ studentId, courseId });

    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!enrollment) return res.status(403).json({ success: false, message: 'أنت غير مشترك في هذا الكورس' });

    // 2️⃣ التحقق من حالة الكورس (قفل الإدارة)
    if (course.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: '⏳ هذا الكورس قيد المراجعة حالياً، سيتوفر الامتحان فور اعتماده.' 
      });
    }

    // 3️⃣ 🛡️ القفل الحاسم: فحص إنهاء "كل" المحتويات السابقة (دروس + امتحانات سكاشن)
    const allRequiredContentIds = [];
    course.sections.forEach(section => {
      // إضافة IDs الدروس
      if (section.lessons) {
        section.lessons.forEach(lesson => allRequiredContentIds.push(lesson._id.toString()));
      }
      // إضافة IDs امتحانات السكاشن (لأنها بوابة لازم تخلص)
      if (section.exam && section.exam._id) {
        allRequiredContentIds.push(section.exam._id.toString());
      }
    });

    // التأكد إن كل ID مطلوب موجود في مصفوفة المكتمل عند الطالب
    const completedIds = enrollment.completedContents.map(id => id.toString());
    const missingContent = allRequiredContentIds.filter(id => !completedIds.includes(id));

    if (missingContent.length > 0) {
      return res.status(403).json({ 
        success: false,
        message: `🔒 مسموح فقط للأبطال! يجب إنهاء جميع الدروس وامتحانات السكاشن السابقة أولاً (باقي لك ${missingContent.length} محتوى).` 
      });
    }

    // 4️⃣ التأكد من وجود محتوى للامتحان
    if (!course.finalExam || !course.finalExam.questions || course.finalExam.questions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'المدرس لم يرفع الامتحان النهائي لهذا الكورس بعد.' 
      });
    }

    // 5️⃣ إرسال الامتحان مؤمن (بدون الإجابات الصحيحة)
    const examData = {
      title: course.finalExam.title || "الامتحان النهائي",
      passingScore: course.finalExam.passingScore || 50,
      questions: course.finalExam.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options
      }))
    };

    return res.status(200).json({
      success: true,
      message: "جاهز للتحدي؟ حظاً موفقاً في الامتحان النهائي!",
      data: examData
    });

  } catch (error) {
    console.error("getFinalExam error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};




exports.completeContent = async (req, res) => {
  try {
    const studentId = req.user && (req.user.id || req.user._id);
    const { contentId } = req.params;
    const { courseId } = req.body || {};

    console.log(`\n--- 🔄 [START] completeContent ---`);
    console.log(`📍 StudentID: ${studentId} | CourseID: ${courseId} | ContentID: ${contentId}`);

    if (!studentId || !courseId || !contentId) {
      console.log("⚠️ Error: Missing required fields");
      return res.status(400).json({ success: false, message: "بيانات ناقصة." });
    }

    // 1️⃣ جلب الاشتراك وتفاصيل الكورس
    const enrollment = await Enrollment.findOne({ studentId, courseId }).populate("courseId");

    if (!enrollment) {
      console.log(`❌ Error: No enrollment found for Student: ${studentId} and Course: ${courseId}`);
      return res.status(404).json({ success: false, message: "الاشتراك غير موجود." });
    }
    console.log(`✅ Enrollment Found. Current Progress: ${enrollment.progressPercentage}%`);

    if (enrollment.status === "pending") {
      console.log("🛑 Access Denied: Enrollment status is pending");
      return res.status(403).json({ success: false, message: "يجب تفعيل الاشتراك أولاً." });
    }

    // 2️⃣ حماية: منع التعليم اليدوي للامتحانات
    const isExam = enrollment.courseId.sections.some(s => s.exam && s.exam.toString() === contentId.toString());
    if (isExam) {
      console.log(`🛑 Blocked: Attempted to manually complete an Exam ID: ${contentId}`);
      return res.status(400).json({ 
        success: false, 
        message: "🛑 لا يمكن تخطي الامتحان يدوياً، يجب حل الاختبار والنجاح أولاً." 
      });
    }

    // 3️⃣ تشيك التسلسل الصارم (بيعتمد على الدالة التانية)
    console.log(`🛡️ Calling canAccessContent...`);
    if (!canAccessContent(enrollment, enrollment.courseId, contentId)) {
      console.log(`🛑 Sequence Block: Student cannot access this content yet.`);
      return res.status(403).json({
        success: false,
        message: "🛑 لا يمكنك تخطي الترتيب! يرجى إنهاء المحتوى السابق أولاً."
      });
    }

    // 4️⃣ إضافة المحتوى لقائمة المكتمل
    if (!Array.isArray(enrollment.completedContents)) enrollment.completedContents = [];
    const alreadyCompleted = enrollment.completedContents.some(id => id.toString() === contentId.toString());
    
    if (!alreadyCompleted) {
      enrollment.completedContents.push(contentId);
      console.log(`➕ Added content to completedContents. List size: ${enrollment.completedContents.length}`);
    } else {
      console.log(`ℹ️ Content already marked as completed.`);
    }

    // 5️⃣ 🔥 الربط مع الـ Progress Collection
    console.log(`📡 Syncing with updateStudentProgress model...`);
    await updateStudentProgress(studentId, courseId, contentId, null);

    // 6️⃣ حساب النسبة المئوية
    const totalItemsCount = enrollment.courseId.sections.reduce((acc, sec) => {
      const lessonsCount = sec.contents ? sec.contents.length : 0; 
      const examCount = sec.exam ? 1 : 0;
      return acc + lessonsCount + examCount;
    }, 0);

    console.log(`📊 Math: Completed Items (${enrollment.completedContents.length}) / Total Items (${totalItemsCount})`);

    if (totalItemsCount > 0) {
      enrollment.progressPercentage = Math.min(
        100,
        Math.round((enrollment.completedContents.length / totalItemsCount) * 100)
      );
    }

    if (enrollment.progressPercentage >= 100) {
      enrollment.status = "completed";
      console.log(`🎓 Status changed to COMPLETED!`);
    }

    await enrollment.save();
    console.log(`💾 Enrollment saved. New Progress: ${enrollment.progressPercentage}%`);
    console.log(`--- ✅ [END] completeContent ---\n`);

    return res.status(200).json({
      success: true,
      message: "تم تحديث التقدم بنجاح.",
      data: {
        progressPercentage: enrollment.progressPercentage,
        status: enrollment.status,
      },
    });

  } catch (error) {
    console.error("❌ CRITICAL ERROR in completeContent:", error);
    return res.status(500).json({ success: false, message: "فشل في تحديث التقدم." });
  }
};
// دالة افتراضية للتأكد من التسلسل
// خليه تعريف عادي مش exports عشان الدوال اللي فوق في نفس الملف تشوفه
const canAccessContent = (enrollment, course, requestedContentId) => {
  console.log("\n--- 🚀 [DEBUG START] Checking Sequence ---");
  const reqIdStr = requestedContentId.toString();
  const allContentItems = [];

  // 1️⃣ بناء خريطة الكورس
  course.sections.forEach((section, sIdx) => {
    if (section.contents) {
      section.contents.forEach((cId, cIdx) => {
        allContentItems.push({ id: cId.toString(), type: 'lesson', name: `Sec ${sIdx + 1} - Lesson ${cIdx + 1}` });
      });
    }
    if (section.exam) {
      const eId = section.exam._id ? section.exam._id.toString() : section.exam.toString();
      allContentItems.push({ id: eId, type: 'exam', name: `Sec ${sIdx + 1} - Exam` });
    }
  });

  const requestedIndex = allContentItems.findIndex(item => item.id === reqIdStr);
  if (requestedIndex <= 0) return requestedIndex === 0;

  const previousItem = allContentItems[requestedIndex - 1];
  console.log(`🧐 Checking: [${previousItem.name}] to access [${allContentItems[requestedIndex].name}]`);

  // 2️⃣ التحقق من المحتوى السابق
  if (previousItem.type === 'lesson') {
    return enrollment.completedContents.some(id => id.toString() === previousItem.id);
  } 

  if (previousItem.type === 'exam') {
    const examRecord = enrollment.examResults?.find(r => r.examId.toString() === previousItem.id);
    
    // 🔍 طباعة الـ Record عشان نتأكد إن الـ attempts وصلت فعلاً
    console.log(`📝 Exam Record in DB:`, JSON.stringify(examRecord));

    // التشيك بناءً على سكيما الـ attempts بتاعتك
    // بنشوف لو فيه أي محاولة السكور بتاعها >= 50
    const hasPassed = examRecord && examRecord.attempts?.some(attempt => attempt.score >= 50);

    if (hasPassed) {
      console.log(`✅ Success! Previous Exam Passed.`);
      return true;
    } else {
      console.log(`🛑 Denied! No attempt with score >= 50 found.`);
      return false;
    }
  }
  return false;
};

// PATCH /student/change-password
// Body: { currentPassword, newPassword }
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user && (req.user.id || req.user._id);
    const { currentPassword, newPassword } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User information is missing.",
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password.",
    });
  }
};



const updateStudentProgress = async (userId, courseId, contentId = null, examData = null) => {
  try {
    const Course = require("../models/Course");
    const Progress = require("../models/Progress");

    // 1. جلب الكورس لحساب إجمالي القطع (دروس + امتحانات)
    const course = await Course.findById(courseId);
    if (!course) return;

    let totalItems = 0;
    course.sections.forEach(sec => {
      totalItems += (sec.contents?.length || 0) + (sec.exam ? 1 : 0);
    });

    // 2. جلب سجل التقدم أو إنشاء واحد جديد
    let progress = await Progress.findOne({ userId, courseId });
    if (!progress) progress = new Progress({ userId, courseId });

    // 3. إضافة الدرس المكتمل وتحديث آخر ظهور
    if (contentId) {
      if (!progress.completedContents.includes(contentId)) {
        progress.completedContents.push(contentId);
      }
      progress.lastAccessedContent = contentId;
    }

    // 4. إضافة أو تحديث نتيجة الامتحان
    if (examData) {
      const existingExamIndex = progress.examResults.findIndex(
        (r) => r.examId.toString() === examData.examId.toString()
      );

      const examResult = {
        examId: examData.examId,
        score: examData.score,
        status: examData.score >= 50 ? 'passed' : 'failed',
        attemptDate: new Date()
      };

      if (existingExamIndex > -1) {
        // تحديث النتيجة القديمة بالجديدة (عشان لو حسن سكوره)
        progress.examResults[existingExamIndex] = examResult;
      } else {
        // إضافة نتيجة لأول مرة
        progress.examResults.push(examResult);
      }
      
      // تحديث آخر محتوى وصل له كـ "امتحان"
      progress.lastAccessedContent = examData.examId;
    }

    // 5. الحسبة النهائية للنسبة المئوية 🧮
    // بنحسب الدروس المكتملة + الامتحانات اللي حالتها "passed"
    const completedLessons = progress.completedContents.length;
    const passedExams = progress.examResults.filter(r => r.status === 'passed').length;

    const completedItems = completedLessons + passedExams;

    progress.completionPercentage = totalItems > 0 
      ? Math.min(Math.round((completedItems / totalItems) * 100), 100) 
      : 0;
    
    // علامة اكتمال الكورس
    if (progress.completionPercentage >= 100) {
      progress.isCourseCompleted = true;
    } else {
      progress.isCourseCompleted = false; // لو مسح درس أو فشل في امتحان ترجع false
    }

    await progress.save();
    return progress;
  } catch (error) {
    console.error("Error updating progress:", error);
  }
};