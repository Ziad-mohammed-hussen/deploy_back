const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
    index: true
  },

  // 📚 الدروس اللي خلصها الطالب
  completedContents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Content"
  }],

  // 📝 نتائج الامتحانات
  examResults: [
    {
      examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Exam"
      },

      attempts: [
        {
          score: Number,
          answers: [Number], // اختيارات الطالب (index)
          submittedAt: {
            type: Date,
            default: Date.now
          }
        }
      ]
    }
  ],

  // 📊 نسبة التقدم
  progressPercentage: {
    type: Number,
    default: 0
  },

  // 🏁 حالة الكورس
  status: {
    type: String,
    enum: ["active", "completed"],
    default: "active"
  },

  // 🗑 soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
 , status: {
    type: String,
    enum: ['pending', 'active', 'completed'],
    default: 'pending' // ✅ لازم يبدأ كدة
}

}, { timestamps: true });


// 🔥 منع تسجيل نفس الطالب في نفس الكورس مرتين
enrollmentSchema.index(
  { studentId: 1, courseId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Enrollment", enrollmentSchema);