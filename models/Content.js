const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  title: {
    ar: { type: String, required: true },
    en: { type: String, required: true }
  },
  type: { type: String, enum: ["video", "file", "assignment"], required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String }, // mp4, pdf, link
  duration: { type: Number, default: 0 },
  isFreePreview: { type: Boolean, default: false },
  order: { type: Number, required: true },
  assignment: { question: String, maxGrade: Number },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

contentSchema.index({ sectionId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model("Content", contentSchema);