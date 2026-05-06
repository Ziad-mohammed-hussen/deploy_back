const mongoose = require("mongoose");

// ✅ دروس مضمّنة مباشرة داخل الوحدة (بدون References)
const lessonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['video', 'pdf'], default: 'video' },
  url: { type: String, required: true },
  order: { type: Number, default: 0 }
}, { _id: true });

const sectionSchema = new mongoose.Schema({
  title: {
    ar: { type: String, required: true },
    en: { type: String, required: true }
  },
  order: { type: Number, required: true },
  
  // 🔥 الربط بالامتحان (Reference)
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },

  // ✅ دروس مضمّنة مباشرة (فيديوهات وملفات PDF)
  lessons: [lessonSchema],

  // 🔗 مرجع للمحتوى الخارجي (للتوافق مع الكود القديم)
  contents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Content" }],

  totalDuration: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { _id: true });

const courseSchema = new mongoose.Schema({
  title: {
    ar: { type: String, required: true },
    en: { type: String, required: true }
  },
  finalExam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }, // حقل مستقل للفاينل,
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  description: { ar: String, en: String },
  thumbnail: String,
  introVideoUrl: String,
  category: { type: String, required: true },
  price: { type: Number, required: true },
  sections: [sectionSchema],
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  isPublished: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Course", courseSchema);