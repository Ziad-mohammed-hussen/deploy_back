const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const Content = require('../models/Content');
const Exam = require('../models/Exam');
const Progress = require('../models/Progress');
const Enrollment = require('../models/Enrollment');
const Certificate = require('../models/Certificate');
const mongoose = require('mongoose');
// ========== Create Course ========== //
const createCourse = async (req, res) => {
  try {
    console.log("--- 🆕 Start: Create Course Request ---");
    const userId = req.user ? (req.user._id || req.user.id) : '69f26cad7db1f6462c36bfce';
    const userEmail = req.user ? req.user.email : '';

    console.log(`🔍 Lookup: ID=${userId}, Email=${userEmail}`);

    // البحث بالـ ID أو بالبريد الإلكتروني لضمان الوصول
    let teacherProfile = await Teacher.findOne({
      $or: [
        { userId: userId },
        { email: userEmail }
      ]
    });

    if (!teacherProfile && req.user) {
      console.log("🛠️ Auto-creating Teacher profile for:", userEmail);
      teacherProfile = await Teacher.create({
        userId: userId,
        email: userEmail,
        firstName: req.user.firstName || req.user.username || 'Instructor',
        lastName: req.user.lastName || '',
        status: 'approved'
      });
    }

    if (!teacherProfile) {
      console.log("❌ Teacher Profile NOT FOUND and could not be created for User:", userEmail || userId);
      return res.status(403).json({ message: 'يجب إنشاء حساب مدرس أولاً.' });
    }

    console.log("✅ Teacher Profile Ready:", teacherProfile._id);

    // بناء السكاشن مع الدروس المضمّنة
    const sections = (req.body.sections || []).map((sec, idx) => ({
      title: sec.title || { en: sec.titleEn || 'Unit', ar: sec.titleAr || 'وحدة' },
      order: idx + 1,
      lessons: (sec.contents || sec.lessons || []).map((lesson, lIdx) => ({
        title: lesson.title || 'Lesson ' + (lIdx + 1),
        type: lesson.type || 'video',
        url: lesson.url || '',
        order: lIdx + 1
      })).filter(l => l.url) // نتجاهل الدروس بدون رابط
    }));

    const courseData = {
      title: req.body.title,
      description: req.body.description,
      thumbnail: req.body.thumbnail,
      introVideoUrl: req.body.introVideoUrl,
      category: req.body.category,
      price: req.body.price,
      sections: sections,
      instructorId: teacherProfile.userId, // 🔥 التعديل هنا: نستخدم userId مش _id بتاع التيشر
      status: 'pending'
    };

    const course = new Course(courseData);
    await course.save();

    console.log("✅ Course Created! ID:", course._id, "| Sections:", sections.length);
    res.status(201).json({ success: true, course });

  } catch (error) {
    console.error("🔥 createCourse Error:", error.message);
    res.status(500).json({ message: "خطأ في إنشاء الكورس: " + error.message });
  }
};



const addSection = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    console.log("--- 📂 Start: Adding New Section ---");
    console.log(`📍 Course ID: ${courseId} | User: ${userId}`);

    // 1. البحث عن الكورس
    const course = await Course.findById(courseId);
    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: "الكورس غير موجود" });
    }

    // 2. التحقق من الهوية (هل هذا المدرس هو صاحب الكورس أو أدمن؟)
    const isAdmin = req.user && req.user.role === 'admin';
    const teacherProfile = await Teacher.findOne({ userId });

    const isOwner = (
      course.instructorId.toString() === userId.toString() ||
      (teacherProfile && course.instructorId.toString() === teacherProfile._id.toString()) ||
      (teacherProfile && course.instructorId.toString() === teacherProfile.userId.toString())
    );

    if (!isAdmin && !isOwner) {
      console.error("🚫 Access Denied: User is not authorized to add sections to this course");
      return res.status(403).json({ message: 'عذراً، لا يمكنك إضافة سيكشن لكورس لا تملكه.' });
    }

    // 3. حساب الترتيب تلقائياً قبل الـ Push
    const nextOrder = course.sections.length + 1;

    // 3. إضافة السكشن الجديد "مرة واحدة فقط" بكل بياناته المطلوبة
    course.sections.push({
      title: title,     // تأكد إنك باعت ar و en في البوستمان
      order: nextOrder,
      contents: [],
      status: 'pending'
    });

    console.log(`⏳ Calculated Order: ${nextOrder}. Saving to Atlas...`);

    // حفظ التعديلات
    await course.save();

    // جلب بيانات السكشن الأخير اللي اتسيف فعلاً
    const newSection = course.sections[course.sections.length - 1];

    console.log(`✅ Section Created Successfully! ID: ${newSection._id}`);

    res.status(201).json({
      success: true,
      message: "تم إضافة السكشن بنجاح، يمكنك الآن إضافة دروس داخله.",
      sectionId: newSection._id,
      section: newSection
    });

    console.log("--- ✅ End: Section Process Finished ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in addSection:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء إضافة السكشن: " + error.message });
  }
};



// ========== Update Course ========== //
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id || req.userId;

    console.log("--- ✏️ Start: Update Course Request ---");
    console.log(`📍 Targeting Course ID: ${id} | Request by User: ${userId}`);
    // console.log("📦 Data to Update:", JSON.stringify(req.body, null, 2));

    // 1. البحث عن الكورس والتأكد من وجوده
    const course = await Course.findById(id);
    if (!course) {
      console.error("❌ Error: Course not found in Database");
      return res.status(404).json({ message: 'الكورس غير موجود' });
    }

    // 2. التحقق من الهوية (هل هذا المدرس هو صاحب الكورس أو أدمن؟)
    const isAdmin = req.user && req.user.role === 'admin';
    const teacherProfile = await Teacher.findOne({ userId });

    // تأكد من جلب الـ ID سواء كان populated أو لا
    const courseInstrId = course.instructorId?._id ? course.instructorId._id.toString() : course.instructorId?.toString();
    const requesterId = userId.toString();

    const isOwner = (
      courseInstrId === requesterId ||
      (teacherProfile && courseInstrId === teacherProfile._id.toString()) ||
      (teacherProfile && courseInstrId === teacherProfile.userId.toString())
    );

    console.log(`🔐 Auth Check: isAdmin=${isAdmin}, isOwner=${isOwner} | Requester=${requesterId} | CourseOwner=${courseInstrId}`);

    if (!isAdmin && !isOwner) {
      console.error("🚫 Access Denied: User is not authorized to edit this course");
      return res.status(403).json({ message: 'عذراً، لا يمكنك تعديل كورس لا تملكه.' });
    }

    // 3. قاعدة الموافقة (Approved Logic)
    // المدرس يقدر يعدل حتى لو الكورس مقبول، بس هنرجعه بيندينج للمراجعة تاني
    // (تم إزالة البلوك الصارم للسماح للمدرس بالتحديث)

    // 4. تنفيذ التعديل
    console.log("⏳ Updating course in Atlas...");

    // بنمنع المدرس إنه يغير الـ status بنفسه لـ approved من خلال الـ body
    const { status: bodyStatus, instructorId: bodyInstrId, ...safeData } = req.body;

    // لو أدمن بيعدل، خليه يحافظ على الاستاتس اللي باعتها، لو مدرس رجعه بيندينج
    const finalStatus = isAdmin ? (bodyStatus || course.status) : 'pending';

    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      { ...safeData, status: finalStatus },
      { new: true, runValidators: true }
    );

    console.log("✅ Course Updated Successfully!");

    res.json({
      success: true,
      message: "تم تحديث بيانات الكورس بنجاح، وهو قيد مراجعة التعديلات.",
      course: updatedCourse
    });

    console.log("--- ✅ End: Update Process Finished ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in updateCourse:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء التحديث: " + error.message });
  }
};
// ========== Delete Course ========== //
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : req.userId;

    console.log("--- 🗑️ Start: Full Course Deletion ---");
    console.log(`📍 Course ID to Delete: ${id} | Requested by User: ${userId}`);

    // 1. البحث عن الكورس والتأكد من الملكية
    const course = await Course.findById(id);
    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: 'الكورس غير موجود بالفعل' });
    }

    // التأكد إن المدرس هو صاحب الكورس أو أدمن
    const isAdmin = req.user && req.user.role === 'admin';
    const teacherProfile = await Teacher.findOne({ userId });

    const courseInstrId = course.instructorId?._id ? course.instructorId._id.toString() : course.instructorId?.toString();
    const requesterId = userId.toString();

    const isOwner = (
      courseInstrId === requesterId ||
      (teacherProfile && courseInstrId === teacherProfile._id.toString()) ||
      (teacherProfile && courseInstrId === teacherProfile.userId.toString())
    );

    if (!isAdmin && !isOwner) {
      console.error("🚫 Access Denied: User is not authorized to delete this course");
      return res.status(403).json({ message: 'لا تملك صلاحية حذف هذا الكورس' });
    }

    // 2. تنظيف البيانات المرتبطة (The Cleanup)
    console.log("⏳ Cleaning up related data in Atlas...");

    // مسح كل المحتويات (فيديوهات/ملفات) المرتبطة بهذا الكورس
    const deletedContents = await Content.deleteMany({ courseId: id });
    console.log(`✅ Deleted ${deletedContents.deletedCount} items from Content collection`);

    // مسح كل الامتحانات المرتبطة بهذا الكورس
    const deletedExams = await Exam.deleteMany({ courseId: id });
    console.log(`✅ Deleted ${deletedExams.deletedCount} exams from Exams collection`);

    // مسح سجلات تقدم الطلاب والاشتراكات (اختياري حسب رغبتك، بس الأفضل يتمسحوا)
    await Progress.deleteMany({ courseId: id });
    await Enrollment.deleteMany({ courseId: id });
    console.log("✅ Deleted all Progress and Enrollment records for this course");

    // 3. مسح الكورس نفسه في النهاية
    await Course.findByIdAndDelete(id);
    console.log("🗑️ Final Step: Course document deleted from Courses collection");

    res.json({
      success: true,
      message: 'تم حذف الكورس وجميع محتوياته وسجلات الطلاب المرتبطة به بنجاح'
    });

    console.log("--- ✅ End: Deletion Process Finished ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in deleteCourse:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء عملية الحذف الشامل: " + error.message });
  }
};

// ========== Get Courses with Search & Filters ========== //
const getFilteredCourses = async (req, res) => {
  try {
    console.log("--- 🔍 Start: Fetch Filtered Courses ---");
    console.log("📥 Query Params:", req.query);

    let filter = {};

    // 1. منطق الحماية (الأمان)
    // الطالب بيشوف الـ approved بس، الإدمن بيشوف كل حاجة
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) {
      filter.status = 'approved';
      console.log("🛡️ Filter applied: Showing only APPROVED courses for regular user.");
    } else if (req.query.status) {
      filter.status = req.query.status;
      console.log(`🛠️ Admin filter applied: Showing ${req.query.status} courses.`);
    }

    // 2. الفلاتر الاختيارية
    if (req.query.teacherId) {
      filter.instructorId = req.query.teacherId; // تأكدنا من المسمى الجديد
    }

    if (req.query.track) {
      filter.track = req.query.track;
    }

    // 3. منطق البحث (Search Logic)
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: 'i' };
      filter.$or = [
        { "title.ar": searchRegex },
        { "title.en": searchRegex },
        { "description.ar": searchRegex },
        { "description.en": searchRegex },
        { track: searchRegex },
        { category: searchRegex }
      ];
      console.log(`🔎 Search term detected: "${req.query.search}"`);
    }

    // 4. تنفيذ الطلب مع الـ Populate
    console.log("⏳ Querying Atlas with filter:", JSON.stringify(filter));

    const courses = await Course.find(filter)
      .populate('instructorId', 'name email') // بنجيب بيانات المدرس الأساسية
      .sort({ createdAt: -1 }); // الجديد دايمًا يظهر فوق

    console.log(`✅ Success: Found ${courses.length} courses.`);

    res.json({
      success: true,
      count: courses.length,
      courses: courses
    });

    console.log("--- ✅ End: Request Handled ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in getFilteredCourses:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الكورسات: " + error.message });
  }
};
// ========== Get Course by ID ========== //
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("--- 📖 Start: Get Course Details ---");
    console.log(`📍 Fetching Course ID: ${id}`);

    // 1. جلب الكورس (بدون فلترة الدروس في البداية)
    const course = await Course.findById(id)
      .populate('instructorId', 'name email bio')
      .populate({
        path: 'sections.exam',
        model: 'Exam'
      })
      .populate({
        path: 'finalExam',
        model: 'Exam'
      });

    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: 'الكورس غير موجود' });
    }

    // 2. التحقق من الهوية (في وضع التطوير: السماح للجميع)
    // 2. التحقق من الهوية بشكل فائق الأمان
    const isAdmin = (req.user && req.user.role === 'admin');
    const userId = req.user?.id || req.user?._id || null;
    const teacherProfile = userId ? await Teacher.findOne({ userId }) : null;

    let isOwner = false;
    if (teacherProfile && course && course.instructorId) {
      // الحصول على الـ ID سواء كان populated أو لا
      const courseInstrId = course.instructorId._id ? course.instructorId._id.toString() : course.instructorId.toString();
      const myProfileId = teacherProfile._id.toString();
      const myUserId = teacherProfile.userId.toString();

      console.log(`🛠️ Final Comparison: Course(${courseInstrId}) vs Me(${myProfileId} / ${myUserId})`);
      isOwner = (courseInstrId === myProfileId || courseInstrId === myUserId);
    }

    // ✅ السماح بالدخول للمدرسين أو المالك أو الأدمن
    const isTeacher = req.user && req.user.role === 'teacher';
    if (isOwner || isAdmin || isTeacher) {
      // Access Granted
    } else if (course.status !== 'approved') {
      return res.status(403).json({ message: 'هذا الكورس غير متاح حالياً للمشاهدة.' });
    }

    console.log("🔓 Access Granted. Sending course data...");
    res.json({
      success: true,
      course: course
    });

    console.log("--- ✅ End: Request Handled ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in getCourseById:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء جلب تفاصيل الكورس: " + error.message });
  }
};

// ========== Get My Courses (for teacher) ========== //
const getMyCourses = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log("--- 👨‍🏫 Get My Courses ---");
    console.log("User ID:", userId);

    const courses = await Course.find({
      instructorId: userId
    })
      .sort({ createdAt: -1 })
      .select('title status track category createdAt thumbnail price sections');

    res.json({
      success: true,
      count: courses.length,
      courses
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
// ========== Get Courses by Track ========== //
const getCoursesByTrack = async (req, res) => {
  try {
    const { track } = req.params;

    console.log("--- 🛣️ Start: Get Courses By Track ---");
    console.log(`🎯 Targeted Track: ${track}`);

    // 1. البحث عن الكورسات التي تنتمي للـ Track وحالتها "مقبولة" فقط
    console.log("⏳ Querying Atlas for approved courses...");

    const courses = await Course.find({
      track: track,
      status: 'approved'
    })
      .populate('instructorId', 'name email profileImage') // بيانات المدرس اللي الطالب محتاجها
      .select('title description thumbnail price ratings track createdAt') // بيانات كارت الكورس فقط
      .sort({ createdAt: -1 });

    // 2. التحقق من وجود نتائج
    if (!courses || courses.length === 0) {
      console.warn(`⚠️ No approved courses found for track: ${track}`);
      return res.status(200).json({
        success: true,
        count: 0,
        courses: [],
        message: 'لا توجد كورسات متاحة حالياً في هذا المسار.'
      });
    }

    console.log(`✅ Success: Found ${courses.length} courses in [${track}]`);

    // 3. الرد بالبيانات
    res.json({
      success: true,
      count: courses.length,
      courses: courses
    });

    console.log("--- ✅ End: Track Fetching Completed ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in getCoursesByTrack:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء جلب كورسات المسار: " + error.message });
  }
};

// ========== Get Section========== //
const getSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const userId = req.user ? req.user.id : req.userId;

    console.log("--- 📂 Start: Get Section Details ---");
    console.log(`📍 Course: ${courseId} | Section: ${sectionId}`);

    // 1. جلب الكورس وعمل Populate للدروس والامتحان الخاص بالسكشن
    const course = await Course.findById(courseId).populate({
      path: 'sections.contents',
      model: 'Content',
      match: { status: 'approved' } // الطالب ميشوفش غير الدروس المقبولة
    }).populate('sections.exam');

    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: 'Course not found' });
    }

    // 2. تحديد السكشن المطلوب
    const section = course.sections.id(sectionId);
    if (!section) {
      console.error("❌ Error: Section not found");
      return res.status(404).json({ message: 'Section not found' });
    }

    // 3. التحقق من الصلاحيات (أدمن، مدرس الكورس، أو طالب مشترك)
    const isAdmin = req.user?.role === 'admin';
    const teacherProfile = await Teacher.findOne({ userId });
    const isTeacher = teacherProfile && course.instructorId.toString() === teacherProfile._id.toString();

    if (!isAdmin && !isTeacher) {
      // لو طالب، نتأكد إن الكورس مقبول أصلاً
      if (course.status !== 'approved') {
        return res.status(403).json({ message: 'هذا الكورس غير متاح حالياً' });
      }

      // 4. منطق "قفل السكاشن": هل خلص السكشن اللي قبله؟
      const progress = await Progress.findOne({ userId, courseId });
      const currentIndex = course.sections.findIndex(s => s._id.toString() === sectionId);

      if (currentIndex > 0) {
        const previousSectionId = course.sections[currentIndex - 1]._id;
        const isPrevCompleted = progress && progress.completedSections.includes(previousSectionId);

        if (!isPrevCompleted) {
          console.warn(`🚫 Blocked: Section ${currentIndex} is locked. Previous section not completed.`);
          return res.status(403).json({
            message: 'يجب إكمال السيكشن السابق واجتياز امتحانه أولاً لفتح هذا المحتوى.'
          });
        }
      }
    }

    console.log("✅ Access Granted to Section:", section.title.en);
    res.json({
      success: true,
      section: section
    });

    console.log("--- ✅ End: Section Data Sent ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in getSection:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء جلب بيانات السيكشن: " + error.message });
  }
};
// ========== Submit Final Exam ========== //

const submitFinalExam = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;

    console.log("--- 🎓 Start: Final Exam Submission ---");
    console.log(`👤 Student: ${userId} | 📚 Course: ${courseId}`);

    // 1. جلب الكورس والتحقق من حالته
    const course = await Course.findById(courseId);
    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: 'الكورس غير موجود' });
    }

    if (course.status !== 'approved') {
      return res.status(403).json({ message: 'هذا الكورس غير متاح حالياً' });
    }

    // 2. جلب الامتحان النهائي من جدول Exams (باسم مستعار للأسئلة الصحيحة)
    console.log("⏳ Fetching Final Exam data...");
    const exam = await Exam.findOne({ courseId, type: 'final' }).select("+questions.correctAnswerIndex");

    if (!exam || exam.questions.length === 0) {
      console.error("❌ Error: Final exam not found or empty");
      return res.status(400).json({ message: 'المدرس لم يضع الامتحان النهائي لهذا الكورس بعد' });
    }

    // 3. التأكد من إنهاء الطالب لجميع دروس الكورس (الـ Progress)
    const Progress = require("../models/Progress");
    console.log("🕵️ Verifying student completion progress...");
    const progress = await Progress.findOne({ userId, courseId });

    // هنجيب إجمالي عدد المحتويات (Contents) في كل السكاشن
    const totalRequiredContents = course.sections.reduce((acc, sec) => acc + (sec.lessons ? sec.lessons.length : 0), 0);
    const studentCompletedCount = progress ? progress.completedContents.length : 0;

    console.log(`📊 Progress: ${studentCompletedCount}/${totalRequiredContents}`);

    if (studentCompletedCount < totalRequiredContents) {
      console.warn("🚫 Blocked: Student hasn't finished all lessons");
      return res.status(403).json({ message: 'يجب إنهاء جميع دروس السكاشن أولاً قبل دخول الامتحان النهائي' });
    }

    // 4. منطق التصحيح
    console.log("📝 Grading exam...");
    let scoreCount = 0;
    let totalPoints = 0;

    exam.questions.forEach((q, idx) => {
      const pts = q.grade || q.points || 1;
      totalPoints += pts;
      if (answers && answers[idx] === q.correctAnswerIndex) {
        scoreCount += pts;
      }
    });

    const finalPercentage = (scoreCount / totalPoints) * 100;
    const isPassed = finalPercentage >= (exam.passingScore || 50);

    console.log(`🎯 Result: Score ${finalPercentage}% | Passed: ${isPassed}`);

    // 5. في حالة النجاح: إصدار الشهادة وتحديث الـ Enrollment
    if (isPassed) {
      console.log("🎊 Student Passed! Issuing Certificate...");

      const serial = `CERT-${courseId.toString().slice(-4)}-${userId.toString().slice(-4)}-${Date.now().toString().slice(-5)}`;

      // إصدار أو تحديث الشهادة
      await Certificate.findOneAndUpdate(
        { studentId: userId, courseId },
        {
          certificateSerial: serial,
          issueDate: new Date(),
          grade: finalPercentage
        },
        { upsert: true, new: true }
      );

      // تحديث حالة الاشتراك لـ Completed
      await Enrollment.findOneAndUpdate(
        { studentId: userId, courseId },
        { status: 'completed', completionDate: new Date() }
      );
    }

    res.json({
      success: true,
      passed: isPassed,
      score: finalPercentage,
      message: isPassed ? 'ألف مبروك! لقد اجتزت الكورس بنجاح وتم إصدار شهادتك.' : 'للأسف لم تتخطى درجة النجاح، يمكنك المراجعة والمحاولة مرة أخرى.'
    });

    console.log("--- ✅ End: Final Exam Processed ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in submitFinalExam:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء تقديم الامتحان: " + error.message });
  }
};

// ========== Get Teacher Stats ========== //
const getTeacherStats = async (req, res) => {
  try {
    // Dev Bypass: If no user is logged in, default to Omar Atef's ID
    const userId = req.user ? req.user.id : '69f26cad7db1f6462c36bfce';

    const teacherProfile = await Teacher.findOne({ userId });
    if (!teacherProfile) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }
    const courses = await Course.find({ instructorId: teacherProfile._id });
    const courseIds = courses.map(c => c._id);

    const Enrollment = require('../models/Enrollment');
    const Payment = require('../models/Payment');
    const Review = require('../models/Review');

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalStudents,
      thisMonthRevenue,
      lastMonthRevenue,
      totalYTDEarnings,
      avgRating,
      pendingCourses,
      earningsHistory
    ] = await Promise.all([
      Enrollment.countDocuments({ courseId: { $in: courseIds }, isDeleted: false }),
      Payment.aggregate([
        { $match: { courseId: { $in: courseIds }, status: 'completed', createdAt: { $gte: firstDayOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { courseId: { $in: courseIds }, status: 'completed', createdAt: { $gte: firstDayOfLastMonth, $lt: firstDayOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { courseId: { $in: courseIds }, status: 'completed', createdAt: { $gte: firstDayOfYear } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Review.aggregate([
        { $match: { courseId: { $in: courseIds } } },
        { $group: { _id: null, avg: { $avg: '$rating' } } }
      ]),
      Course.countDocuments({
        $or: [
          { instructorId: teacherProfile._id },
          { instructorId: teacherProfile.userId }
        ],
        status: 'pending'
      }),
      Payment.aggregate([
        { $match: { courseId: { $in: courseIds }, status: 'completed', createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
        {
          $group: {
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
            total: { $sum: "$amount" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ])
    ]);

    const curRev = thisMonthRevenue[0]?.total || 0;
    const lastRev = lastMonthRevenue[0]?.total || 0;
    const revChange = lastRev === 0 ? 100 : (((curRev - lastRev) / lastRev) * 100).toFixed(1);

    res.json({
      success: true,
      stats: {
        monthlyRevenue: curRev,
        revChange: revChange,
        activeStudents: totalStudents,
        avgRating: avgRating[0]?.avg?.toFixed(2) || 0,
        pendingApprovals: pendingCourses,
        totalYTDEarnings: totalYTDEarnings[0]?.total || 0,
        earningsHistory: earningsHistory.map(h => ({
          month: new Date(h._id.year, h._id.month - 1).toLocaleString('default', { month: 'short' }),
          total: h.total
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTeacherInquiries = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.userId;
    const Notification = require('../models/Notification');
    const inquiries = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(5);
    res.json({ success: true, inquiries });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTeacherStudents = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : '69f26cad7db1f6462c36bfce';
    const teacherProfile = await Teacher.findOne({ userId });

    if (!teacherProfile) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }

    const Review = require('../models/Review');
    const Enrollment = require('../models/Enrollment');
    const Progress = require('../models/Progress');

    // جلب كل كورسات المدرس (بالـ ID بتاع البروفايل أو الـ ID بتاع اليوزر)
    const courses = await Course.find({
      $or: [
        { instructorId: teacherProfile._id },
        { instructorId: teacherProfile.userId }
      ]
    });
    const courseIds = courses.map(c => c._id);

    // جلب الاشتراكات مع بيانات الطالب والكورس
    const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
      .populate('studentId', 'firstName lastName email username')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    // تصفية الاشتراكات التي ليس لها طالب أو كورس (معدلة)
    const validEnrollments = enrollments.filter(e => e.studentId && e.courseId);

    // جلب التقدم لكل طالب في هذه الكورسات للحصول على الدرجات
    const studentsWithGrades = await Promise.all(validEnrollments.map(async (enrol) => {
      const progress = await Progress.findOne({
        userId: enrol.studentId._id,
        courseId: enrol.courseId._id
      });

      return {
        ...enrol.toObject(),
        progress: progress ? {
          completionPercentage: progress.completionPercentage,
          examResults: progress.examResults,
          isCourseCompleted: progress.isCourseCompleted
        } : null
      };
    }));

    res.json({ success: true, students: studentsWithGrades });
  } catch (error) {
    console.error("Error in getTeacherStudents:", error);
    res.status(500).json({ message: error.message });
  }
};

const getTeacherReviews = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : '69f26cad7db1f6462c36bfce';
    const teacherProfile = await Teacher.findOne({ userId });

    if (!teacherProfile) {
      return res.status(404).json({ message: 'Teacher profile not found' });
    }

    const Review = require('../models/Review');
    const courses = await Course.find({
      $or: [
        { instructorId: teacherProfile._id },
        { instructorId: teacherProfile.userId }
      ]
    });
    const courseIds = courses.map(c => c._id);

    const reviews = await Review.find({ courseId: { $in: courseIds } })
      .populate('studentId', 'firstName lastName username')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTeacherEarnings = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.userId;
    const teacherProfile = await Teacher.findOne({ userId });
    const Payment = require('../models/Payment');
    const courses = await Course.find({
      $or: [
        { instructorId: teacherProfile._id },
        { instructorId: teacherProfile.userId }
      ]
    });
    const courseIds = courses.map(c => c._id);

    const earnings = await Payment.find({ courseId: { $in: courseIds }, status: 'completed' })
      .populate('studentId', 'firstName lastName email')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    res.json({ success: true, earnings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createCourse,
  addSection,
  updateCourse,
  deleteCourse,
  getFilteredCourses,
  getCourseById,
  getMyCourses,
  getCoursesByTrack,
  getSection,
  submitFinalExam,
  getTeacherStats,
  getTeacherInquiries,
  getTeacherStudents,
  getTeacherEarnings,
  getTeacherReviews
};