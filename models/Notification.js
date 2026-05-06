const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    index: true 
  },

  isGlobal: { type: Boolean, default: false },

  title: { ar: String, en: String },
  message: { ar: String, en: String },

  type: { 
    type: String, 
    enum: ["exam", "course", "system", "suggestion"], 
    default: "system" 
  },

  actionUrl: { type: String, default: null },

  referenceModel: { 
    type: String, 
    enum: ["Course", "Exam", "ChatRoom"] 
  },

  referenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: "referenceModel" 
  },

  isRead: { type: Boolean, default: false },
  readAt: Date,

  isDeleted: { type: Boolean, default: false },

  isForAdmin: { type: Boolean, default: false }

}, { timestamps: true });

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

// Validation
notificationSchema.pre('save', function(next) {
  if (!this.recipient && !this.isGlobal && !this.isForAdmin) {
    return next(new Error('Notification must have recipient or be global/admin'));
  }

  if (!this.title?.en && !this.title?.ar) {
    return next(new Error('Notification must have a title'));
  }

  if (!this.message?.en && !this.message?.ar) {
    return next(new Error('Notification must have a message'));
  }

  next();
});

module.exports = mongoose.model("Notification", notificationSchema);