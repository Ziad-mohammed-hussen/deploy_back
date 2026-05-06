const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  // لو الـ courseId موجود يبقى تقييم لكورس، لو NULL يبقى تقييم للمنصة
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: false, // 👈 غيرناها لـ false عشان ينفع يبقى فاضي
    index: true
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  comment: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // 🔥 ده الحقل اللي هيعملك "آراء العملاء" (Testimonials)
  isFeatured: { 
    type: Boolean, 
    default: false // الأدمن يخليها true عشان تظهر في الصفحة الرئيسية
  },

  isApproved: {
    type: Boolean,
    default: true 
  }
}, { timestamps: true });

// تعديل الـ Index عشان يوزر واحد يقدر يقيم المنصة مرة (null) ويقيم كذا كورس
reviewSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);