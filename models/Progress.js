const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
  userId: { 
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
  completedContents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Content"
  }],
  completedSections: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  examResults: [{
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
    score: Number,
    status: { type: String, enum: ['passed', 'failed'] },
    attemptDate: { type: Date, default: Date.now }
  }],
  // ⚡ إضافات للداشبورد الاحترافي:
  lastAccessedContent: { type: mongoose.Schema.Types.ObjectId, ref: "Content" },
  totalTimeSpent: { type: Number, default: 0 }, // للدراسة التحليلية
  
  completionPercentage: { 
    type: Number, 
    default: 0 
  },
  isCourseCompleted: { type: Boolean, default: false }
}, { timestamps: true });

progressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model("Progress", progressSchema);