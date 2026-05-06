const Progress = require('../models/Progress');
const Content = require('../models/Content');
const Exam = require('../models/Exam');

// 1) تعليم الدرس كمكتمل (الزرار اللي الطالب بيدوس عليه)
const markAsCompleted = async (req, res) => {
  try {
    const { courseId, contentId } = req.body;
    const userId = req.user.id;

    // بنضيف الـ contentId في المصفوفة وبنستخدم $addToSet عشان نمنع التكرار
    const progress = await Progress.findOneAndUpdate(
      { userId, courseId },
      { $addToSet: { completedContents: contentId } },
      { upsert: true, new: true }
    );

    res.status(200).json({ 
      message: "Content marked as completed", 
      completedCount: progress.completedContents.length 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2) تسليم امتحان السيكشن والنجاح فيه
const submitSectionExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { answers } = req.body; 
    const userId = req.user.id;

    // جلب الامتحان مع الإجابات الصحيحة (اللي إحنا خافيينها بـ select: false)
    const exam = await Exam.findById(examId).select("+questions.correctAnswerIndex");
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    // حساب الدرجة
    let score = 0;
    exam.questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswerIndex) score += q.grade;
    });

    const totalGrade = exam.questions.reduce((acc, q) => acc + q.grade, 0);
    const finalScore = (score / totalGrade) * 100;
    const passed = finalScore >= exam.minScore;

    // لو نجح، بنضيف السيكشن لقائمة السكاشن المكتملة في الـ Progress
    if (passed) {
      await Progress.findOneAndUpdate(
        { userId, courseId: exam.courseId },
        { $addToSet: { completedSections: exam.sectionId } },
        { upsert: true }
      );
    }

    res.json({
      message: passed ? "Passed! Section unlocked." : "Failed. Try again.",
      score: finalScore,
      passed
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { markAsCompleted, submitSectionExam };