const Exam = require('../models/Exam');
const Course = require('../models/Course');

// ================== Create Exam ================== //
exports.createExam = async (req, res) => {
  try {
    const { courseId, sectionId, isFinal, title, duration, minScore, questions } = req.body;

    console.log("📝 Creating exam for course:", courseId, "| section:", sectionId || 'FINAL');

    // 1. Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // 2. Create the exam document
    const newExam = new Exam({
      courseId,
      sectionId: sectionId || null,
      isFinal: isFinal || !sectionId,
      title: typeof title === 'object' ? title : { en: title, ar: title },
      duration: duration || 60,
      minScore: minScore || 50,
      questions: questions || [],
      status: 'approved',
      isPublished: true
    });

    const savedExam = await newExam.save();
    console.log("✅ Exam saved:", savedExam._id);

    // 3. Link exam to course or section
    if (isFinal || !sectionId) {
      course.finalExam = savedExam._id;
      console.log("🏆 Linked as Final Exam to course");
    } else {
      const section = course.sections.id(sectionId);
      if (section) {
        section.exam = savedExam._id;
        console.log("📎 Linked exam to section:", section.title?.en);
      } else {
        console.warn("⚠️ Section not found in course, exam saved but not linked");
      }
    }

    await course.save();

    res.status(201).json({
      success: true,
      message: "Exam created and linked successfully",
      exam: savedExam
    });

  } catch (error) {
    console.error("❌ Error creating exam:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================== Get All Exams for Instructor ================== //
exports.getInstructorExams = async (req, res) => {
  try {
    const exams = await Exam.find({ isDeleted: false })
      .populate('courseId', 'title category');
    res.json({ success: true, exams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================== Get Exam by ID ================== //
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .select('+questions.correctAnswerIndex'); // المدرس يرى الإجابات
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
