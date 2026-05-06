const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
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

  enrollmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Enrollment",
    required: true
  },

  // 🔥 رقم تسلسلي للتحقق
  certificateSerial: {
    type: String,
    unique: true,
    required: true
  },

  // 📄 رابط الشهادة (PDF)
  certificateUrl: {
    type: String
  },

  issueDate: {
    type: Date,
    default: Date.now
  },

  isRevoked: {
    type: Boolean,
    default: false // لو عايز تلغي شهادة
  }

}, { timestamps: true });


// 🔥 كل طالب ياخد شهادة واحدة لكل كورس
certificateSchema.index(
  { studentId: 1, courseId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);