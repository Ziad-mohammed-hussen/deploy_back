 const Course = require('../models/Course');
 const Progress = require('../models/Progress');
 const Exam = require('../models/Exam');
const Content = require('../models/Content');
const Teacher = require('../models/Teacher');

// ========== add lesson/section========== //
const addContent = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    console.log("--- 🚀 Start: Add Content Request ---");
    console.log("📍 Params - CourseID:", courseId, "| SectionID:", sectionId);
    console.log("📦 Received Body:", JSON.stringify(req.body, null, 2));

    // 1. التأكد من وجود الكورس
    const course = await Course.findById(courseId);
    if (!course) {
      console.error("❌ Error: Course not found in Database");
      return res.status(404).json({ message: 'Course not found' });
    }

    // 2. التحقق من الملكية
    const userId = req.user?._id || req.user?.id;
    const isAdmin = req.user && req.user.role === 'admin';
    const teacherProfile = await Teacher.findOne({ userId });
    
    const courseInstrId = course.instructorId?._id ? course.instructorId._id.toString() : course.instructorId?.toString();
    const isOwner = (
      courseInstrId === userId.toString() ||
      (teacherProfile && courseInstrId === teacherProfile._id.toString()) ||
      (teacherProfile && courseInstrId === teacherProfile.userId.toString())
    );

    if (!isAdmin && !isOwner) {
      console.error("🚫 Access Denied: User is not authorized to add content to this course");
      return res.status(403).json({ message: 'ليس لديك صلاحية لإضافة محتوى في هذا الكورس' });
    }

    console.log("✅ Course Match Found:", course.title.en);

    // 2. البحث عن السكشن باستخدام الـ ID الحقيقي من أطلس
    const section = course.sections.id(sectionId);
    if (!section) {
      console.error("❌ Error: Section ID not found within this course");
      return res.status(404).json({ message: 'Section not found' });
    }
    console.log("✅ Section Match Found:", section.title.en);

    // 3. إنشاء المحتوى في جدول Content (بوضعية الانتظار pending)
    console.log("⏳ Creating new Content record...");
    const newContent = new Content({
      ...req.body,
      courseId: courseId,
      sectionId: sectionId,
      status: 'pending' // 🔒 لا يظهر للطالب إلا بعد موافقة الإدارة
    });

    const savedContent = await newContent.save();
    console.log("✅ Content saved in Content Collection. ID:", savedContent._id);

    // 4. ربط الـ ID بالسكشن في مصفوفة الـ contents
    console.log("🔗 Linking Content ID to Course Section...");
    section.contents.push(savedContent._id);

    // 5. حفظ التعديلات في الكورس
    await course.save();
    console.log("💾 Course updated successfully with new content reference");

    res.status(201).json({ 
      success: true,
      message: "تم إضافة المحتوى بنجاح وهو في انتظار مراجعة الإدارة.", 
      contentId: savedContent._id 
    });

    console.log("--- ✅ End: Request Handled Successfully ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in addContent:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ message: "حدث خطأ في الخادم: " + error.message });
  }
};

// ========== delete lesson ========== //
const deleteLesson = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;

    console.log("--- 🗑️ Start: Delete Lesson Request ---");
    console.log(`📍 Targets -> Course: ${courseId}, Section: ${sectionId}, Lesson: ${lessonId}`);

    // 1. التأكد من وجود الكورس وصلاحية المدرس
    const course = await Course.findById(courseId);
    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: 'Course not found' });
    }

    // تأكد من صلاحية المدرس أو الأدمن
    const userId = req.user?._id || req.user?.id;
    const isAdmin = req.user && req.user.role === 'admin';
    const teacherProfile = await Teacher.findOne({ userId });
    
    const courseInstrId = course.instructorId?._id ? course.instructorId._id.toString() : course.instructorId?.toString();
    const isOwner = (
      courseInstrId === userId.toString() ||
      (teacherProfile && courseInstrId === teacherProfile._id.toString()) ||
      (teacherProfile && courseInstrId === teacherProfile.userId.toString())
    );

    if (!isAdmin && !isOwner) {
      console.error("🚫 Access Denied: User is not authorized to delete content from this course");
      return res.status(403).json({ message: 'ليس لديك صلاحية لمسح محتوى في هذا الكورس' });
    }

    // 2. الوصول للسكشن
    const section = course.sections.id(sectionId);
    if (!section) {
      console.error("❌ Error: Section not found in this course");
      return res.status(404).json({ message: 'Section not found' });
    }

    // 3. مسح المرجع (ID) من مصفوفة الـ contents جوه السكشن
    console.log("🔗 Removing Reference from Section array...");
    const initialLength = section.contents.length;
    section.contents = section.contents.filter(id => id.toString() !== lessonId);

    if (section.contents.length === initialLength) {
      console.warn("⚠️ Warning: Lesson ID was not found in section contents");
    }

    // 4. مسح الداتا الفعلية من جدول الـ Content (أهم خطوة في الـ Reference)
    console.log("🔥 Deleting Actual Data from Content Collection...");
    const deletedContent = await Content.findByIdAndDelete(lessonId);
    
    if (!deletedContent) {
      console.warn("⚠️ Warning: Content document already gone from database");
    } else {
      console.log("✅ Content document deleted successfully");
    }

    // 5. حفظ التغييرات في الكورس
    await course.save();
    console.log("💾 Course Saved after cleanup");

    res.json({ 
      success: true, 
      message: 'تم حذف الدرس نهائياً من السكشن ومن قاعدة البيانات' 
    });

    console.log("--- ✅ End: Delete Request Finished ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in deleteLesson:");
    console.error(error.stack);
    res.status(500).json({ message: "خطأ في عملية الحذف: " + error.message });
  }
};

// ========== get filtered lessons ========== //
const getFilteredLessons = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    console.log("--- 🔍 Start: Get Filtered Lessons ---");
    console.log(`📍 Course: ${courseId} | Section: ${sectionId}`);
    console.log(`🧪 Filters - Type: ${req.query.content_type || 'None'} | Search: ${req.query.search || 'None'}`);

    // 1. جلب الكورس وعمل Populate لمصفوفة الـ contents
    // هنا بنقول لـ Mongoose: "روح لجدول الـ Content وهات البيانات اللي الـ IDs بتاعتها موجودة في السكشن ده"
    const course = await Course.findById(courseId).populate({
      path: 'sections.contents',
      model: 'Content'
    });

    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: 'Course not found' });
    }

    // 2. الوصول للسكشن المطلوب
    const section = course.sections.id(sectionId);
    if (!section) {
      console.error("❌ Error: Section not found in this course");
      return res.status(404).json({ message: 'Section not found' });
    }

    // 3. الدروس دلوقتي هي البيانات اللي جت من الـ populate
    let lessons = section.contents; 
    console.log(`📦 Found ${lessons.length} total items in section`);

    // 4. تطبيق الفلترة (Filtering)
    // لاحظ إن الفلترة هنا بتحصل في الـ Memory بعد ما الداتا جت
    if (req.query.content_type) {
      lessons = lessons.filter(l => l.type === req.query.content_type);
      console.log(`🎯 After Type Filter (${req.query.content_type}): ${lessons.length} items`);
    }

    if (req.query.search) {
      const searchTerm = req.query.search.toLowerCase();
      lessons = lessons.filter(l =>
        (l.title.en && l.title.en.toLowerCase().includes(searchTerm)) ||
        (l.title.ar && l.title.ar.toLowerCase().includes(searchTerm))
      );
      console.log(`🎯 After Search Filter: ${lessons.length} items`);
    }

    // 5. إرجاع النتيجة
    res.json({
      success: true,
      count: lessons.length,
      lessons: lessons
    });

    console.log("--- ✅ End: Filtering Completed ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in getFilteredLessons:");
    console.error(error.stack);
    res.status(500).json({ message: "خطأ أثناء جلب الدروس: " + error.message });
  }
};

// ========== complete lesson ========== //
const completeLesson = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;
    const userId = req.user.id; // التأكد من الـ ID بتاع الطالب من التوكن

    console.log("--- ✅ Start: Complete Lesson Request ---");
    console.log(`👤 Student: ${userId} | 📚 Course: ${courseId} | 📄 Lesson: ${lessonId}`);

    // 1. التأكد من وجود الكورس والسكشن والدرس (للتأكد من صحة البيانات)
    const course = await Course.findById(courseId);
    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: 'Course not found' });
    }

    const section = course.sections.id(sectionId);
    if (!section) {
      console.error("❌ Error: Section not found");
      return res.status(404).json({ message: 'Section not found' });
    }

    // 1. التأكد إن الـ lessonId موجود فعلاً (سواء في الدروس المدمجة أو المحتوى المنفصل)
    const isLessonInContents = section.contents && section.contents.some(id => id.toString() === lessonId);
    const isLessonInEmbedded = section.lessons && section.lessons.id(lessonId);

    if (!isLessonInContents && !isLessonInEmbedded) {
      console.error("❌ Error: Lesson ID not found in this section");
      return res.status(404).json({ message: 'Lesson not found in this section' });
    }

    // 2. تحديث سجل التقدم (Progress) للطالب
    console.log("⏳ Updating student progress record...");
    
    // $addToSet بتضمن إن الدرس ميتكررش في القائمة لو الطالب داس "تم" مرتين
    const progress = await Progress.findOneAndUpdate(
      { userId, courseId },
      { $addToSet: { completedContents: lessonId } },
      { upsert: true, new: true }
    );

    console.log(`✅ Progress Updated. Total completed in this course: ${progress.completedContents.length}`);

    // 3. تحديث النسبة المئوية للتقدم (Completion Percentage)
    // نجيب إجمالي عدد الدروس في الكورس كله (مدمجة + منفصلة)
    const totalItemsInCourse = course.sections.reduce((acc, sec) => {
      const lessonsCount = (sec.lessons ? sec.lessons.length : 0);
      const contentsCount = (sec.contents ? sec.contents.length : 0);
      return acc + lessonsCount + contentsCount;
    }, 0);

    const completedCount = progress.completedContents.length;
    const percentage = totalItemsInCourse > 0 ? Math.round((completedCount / totalItemsInCourse) * 100) : 0;
    
    progress.completionPercentage = percentage;
    progress.lastAccessedContent = lessonId;
    await progress.save();

    console.log(`🎯 New Progress: ${percentage}% (${completedCount}/${totalItemsInCourse})`);

    // 4. التحقق هل خلص كل دروس السكشن عشان نفتح له الامتحان؟
    const allLessonIdsInSection = [
      ...(section.contents || []).map(id => id.toString()),
      ...(section.lessons || []).map(l => l._id.toString())
    ];

    const isSectionFinished = allLessonIdsInSection.length > 0 && allLessonIdsInSection.every(id => 
      progress.completedContents.map(c => c.toString()).includes(id)
    );

    if (isSectionFinished) {
      return res.json({
        success: true,
        message: 'عاش يا بطل! خلصت كل دروس السكشن، تقدر دلوقتي تدخل الامتحان.',
        examReady: true,
        examId: section.exam,
        percentage: percentage
      });
    }

    res.json({
      success: true,
      message: 'تم تحديد الدرس كمكتمل بنجاح.',
      sectionCompleted: false,
      percentage: percentage
    });

    console.log("--- ✅ End: Lesson marked as completed ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in completeLesson:");
    console.error(error.stack);
    res.status(500).json({ message: "خطأ أثناء تحديث التقدم: " + error.message });
  }
};
// ========== add/upload section exam (For Teacher) ========== //
const addSectionExam = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    console.log("--- 📝 Start: Add Section Exam Request ---");
    console.log(`📍 CourseID: ${courseId} | SectionID: ${sectionId}`);
    console.log("📦 Exam Content:", JSON.stringify(req.body, null, 2));

    // 1. التأكد من وجود الكورس والسكشن
    const course = await Course.findById(courseId);
    if (!course) {
      console.error("❌ Error: Course not found");
      return res.status(404).json({ message: "الكورس غير موجود" });
    }

    // 2. التحقق من الملكية
    const userId = req.user?._id || req.user?.id;
    const isAdmin = req.user && req.user.role === 'admin';
    const teacherProfile = await Teacher.findOne({ userId });
    
    const courseInstrId = course.instructorId?._id ? course.instructorId._id.toString() : course.instructorId?.toString();
    const isOwner = (
      courseInstrId === userId.toString() ||
      (teacherProfile && courseInstrId === teacherProfile._id.toString()) ||
      (teacherProfile && courseInstrId === teacherProfile.userId.toString())
    );

    if (!isAdmin && !isOwner) {
      console.error("🚫 Access Denied: User is not authorized to add exam to this course");
      return res.status(403).json({ message: 'ليس لديك صلاحية لإضافة امتحان في هذا الكورس' });
    }

    const section = course.sections.id(sectionId);
    if (!section) {
      console.error("❌ Error: Section not found in this course");
      return res.status(404).json({ message: "السكشن غير موجود" });
    }

    // 2. إنشاء الامتحان في جدول مستقل (Exam Model)
    // 2. إنشاء الامتحان في جدول مستقل (Exam Model)
    console.log("⏳ Creating new Exam document in Exams Collection...");
    const newExam = new Exam({
      courseId: courseId,
      sectionId: sectionId,
      title: req.body.title,      // ✅ غيرنا examTitle لـ title عشان تطابق الـ Schema
      duration: req.body.duration, // ✅ ضفنا الـ duration لأنها مطلوبة (required)
      questions: req.body.questions, 
      passingScore: req.body.passingScore || 50,
      status: 'pending' 
    });

    const savedExam = await newExam.save();
    console.log("✅ Exam saved in Database. Exam ID:", savedExam._id);

    // 3. ربط الـ ID بتاع الامتحان بالسكشن المخصص له في الكورس
    console.log("🔗 Linking Exam ID to Course Section...");
    section.exam = savedExam._id;

    // 4. حفظ الكورس بالتعديل الجديد
    await course.save();
    console.log("💾 Course updated with Exam reference");

    res.status(201).json({ 
      success: true,
      message: "تم رفع الامتحان بنجاح وهو في انتظار مراجعة الإدارة.",
      examId: savedExam._id 
    });

    console.log("--- ✅ End: Exam Added Successfully ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in addSectionExam:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء رفع الامتحان: " + error.message });
  }
};
// ========== submit section exam ========== //
const submitSectionExam = async (req, res) => {
  try {
    const { courseId, sectionId, examId } = req.params; // بعتنا الـ examId كمان لضمان الدقة
    const { answers } = req.body; // مصفوفة فيها اختيارات الطالب [0, 2, 1, ...]

    console.log("--- ✍️ Start: Submit Section Exam ---");
    console.log(`👤 User: ${req.user?.id || req.userInfo?.id} | 📄 Exam: ${examId}`);
    
    // 1. جلب بيانات الامتحان من جدوله المستقل
    // بنستخدم .select("+questions.correctAnswer") عشان نجيب الإجابات اللي كانت مخفية
    const exam = await Exam.findById(examId).select("+questions.correctAnswer");

    if (!exam) {
      console.error("❌ Error: Exam document not found");
      return res.status(404).json({ message: "الامتحان غير موجود" });
    }

    // 2. حماية: التأكد إن الإدارة وافقت على الامتحان ده
    if (exam.status !== 'approved') {
      console.warn("🚫 Warning: Attempt to solve a pending exam");
      return res.status(403).json({ message: "هذا الامتحان قيد المراجعة حالياً، لا يمكنك تسليمه" });
    }

    // 3. منطق التصحيح
    console.log("⏳ Checking answers...");
    let score = 0;
    let totalPoints = 0;

    exam.questions.forEach((q, i) => {
      const studentAnswer = answers[i];
      const correctAnswer = q.correctAnswer;
      const points = q.points || 1;
      
      totalPoints += points;

      if (studentAnswer === correctAnswer) {
        score += points;
      }
      
      console.log(`Question ${i + 1}: Student Answer (${studentAnswer}) | Correct (${correctAnswer})`);
    });

    const finalPercentage = (score / totalPoints) * 100;
    const isPassed = finalPercentage >= (exam.passingScore || 50);

    console.log(`📊 Result: Score ${score}/${totalPoints} (${finalPercentage.toFixed(2)}%) | Passed: ${isPassed}`);

    // 4. تحديث سجل التقدم (Progress) لو نجح
    if (isPassed) {
      const userId = req.user ? req.user.id : req.userInfo.id;
      console.log("🎉 Student passed! Recording progress...");
      
      await Progress.findOneAndUpdate(
        { userId, courseId },
        { $addToSet: { completedExams: examId, completedSections: sectionId } }, 
        { upsert: true }
      );
    }

    // 5. الرد بالنتيجة
    res.status(200).json({
      success: true,
      score: finalPercentage,
      points: score,
      totalPoints: totalPoints,
      passed: isPassed,
      message: isPassed ? "مبروك! لقد اجتزت الاختبار بنجاح." : "للأسف، لم تجتز الاختبار، حاول مرة أخرى."
    });

    console.log("--- ✅ End: Exam Submission Handled ---");

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in submitSectionExam:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ أثناء تصحيح الامتحان: " + error.message });
  }
};

const checkContentAccess = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;

    console.log("--- 🛡️ Access Guard: Checking Content Permission ---");
    console.log(`👤 User: ${userId} | 📄 Attempting to access Content: ${contentId}`);

    // 1. نجيب بيانات الدرس الحالي
    const currentContent = await Content.findById(contentId);
    if (!currentContent) {
      console.error("❌ Error: Content document not found");
      return res.status(404).json({ message: "الدرس غير موجود" });
    }

    // 2. السماح الفوري لو هو أول درس في الكورس كله (Order 1 في أول سيكشن)
    // ملحوظة: يفضل تتأكد برضه إنه في السيكشن الأول، بس حالياً هنعتمد على الـ order
    if (currentContent.order === 1) {
      console.log("✅ First lesson detected. Access Granted.");
      return next();
    }

    // 3. نجيب سجل الطالب في الكورس ده
    const progress = await Progress.findOne({ userId, courseId: currentContent.courseId });

    // 4. الحماية من "القفز" فوق الامتحانات
    // لو الدرس ده في سيكشن جديد، لازم نضمن إنه خلص امتحان السيكشن اللي فات
    const course = await Course.findById(currentContent.courseId);
    const sectionIndex = course.sections.findIndex(s => s._id.toString() === currentContent.sectionId.toString());

    if (sectionIndex > 0) {
      const previousSection = course.sections[sectionIndex - 1];
      if (!progress || !progress.completedSections.includes(previousSection._id)) {
        console.warn(`🚫 Blocked: Student must pass exam of section ${sectionIndex} first`);
        return res.status(403).json({ 
          message: "يجب اجتياز امتحان السيكشن السابق أولاً قبل البدء في دروس هذا السيكشن." 
        });
      }
    }

    // 5. التشيك على الدرس اللي قبله مباشرة في نفس السيكشن
    if (currentContent.order > 1) {
      const previousContent = await Content.findOne({
        sectionId: currentContent.sectionId,
        order: currentContent.order - 1
      });

      if (previousContent && (!progress || !progress.completedContents.includes(previousContent._id))) {
        console.warn(`🚫 Blocked: Previous lesson (Order ${currentContent.order - 1}) not finished`);
        return res.status(403).json({ 
          message: "عذراً، يجب إنهاء الدرس السابق أولاً لتتمكن من مشاهدة هذا المحتوى." 
        });
      }
    }

    console.log("✅ All checks passed. Access Granted.");
    next(); 

  } catch (error) {
    console.error("🔥 CRITICAL ERROR in checkContentAccess:");
    console.error(error.stack);
    res.status(500).json({ message: "حدث خطأ في نظام الحماية: " + error.message });
  }
};
const { cloudinary } = require('../config/cloudinary');
const streamifier = require('streamifier');

const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No file buffer found in request");
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log("⏳ Uploading to Cloudinary via Stream... File Size:", req.file.size);

    const streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "video"
            // شيلنا الـ folder للتأكد إن المشكلة مش في صلاحيات المجلدات
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req);
    console.log("✅ Cloudinary Upload Success:", result.secure_url);
    
    res.json({
      success: true,
      message: 'Video uploaded successfully',
      url: result.secure_url
    });

  } catch (error) {
    console.error("🔥 Cloudinary Manual Upload Error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      details: error 
    });
  }
};

module.exports = { 
addContent, 
  deleteLesson, 
  getFilteredLessons, 
  completeLesson,      

  checkContentAccess,
  addSectionExam,
  submitSectionExam,
  uploadVideo
};