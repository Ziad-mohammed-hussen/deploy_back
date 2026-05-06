const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },

  courseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Course", 
    required: true 
  },

  enrollmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Enrollment" 
  },

  amount: { 
    type: Number, 
    required: true 
  },

  paymentMethod: { 
    type: String, 
    enum: ["credit_card", "paypal", "bank_transfer", "stripe"], 
    required: true 
  },

  status: { 
    type: String, 
    enum: ["pending", "completed", "failed"], 
    default: "pending" 
  },

  transactionId: { 
    type: String, 
    unique: true 
  },
  adminShare: { type: Number },
instructorShare: { type: Number },

  // أي ملاحظات إضافية من بوابة الدفع
  notes: String
}, { timestamps: true });

// 🔥 تحسين الأداء: استعلامات سريعة حسب الطالب والكورس
paymentSchema.index({ studentId: 1, courseId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);