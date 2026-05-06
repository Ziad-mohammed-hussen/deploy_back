const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  questionText: {
    ar: { type: String, required: true },
    en: { type: String, required: true }
  },
  options: {
    ar: [{ type: String, required: true }],
    en: [{ type: String, required: true }]
  },
  correctAnswerIndex: { type: Number, required: true, select: false }, // 🔒 الإجابة محمية
  grade: { type: Number, default: 1 }
}, { _id: true });

const examSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId },
  title: {
    ar: { type: String, required: true },
    en: { type: String, required: true }
  },
  isFinal: { type: Boolean, default: false },
  duration: { type: Number, required: true },
  minScore: { type: Number, default: 50 },
  questions: [questionSchema],
  maxAttempts: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isPublished: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Exam", examSchema);