const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  courseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Course", 
    required: true
  },

  participants: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    default: []
  }],

  type: { 
    type: String, 
    enum: ["courseGroup", "private"], 
    default: "courseGroup" 
  },

  lastMessage: {
    text: String,
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },

  lastMessageAt: { type: Date }

}, { timestamps: true });

// Unique per course + type
chatRoomSchema.index({ courseId: 1, type: 1 }, { unique: true });

// Faster queries
chatRoomSchema.index({ participants: 1 });

// Validation
chatRoomSchema.pre('save', function(next) {
  if (this.type === 'private' && this.participants.length !== 2) {
    return next(new Error('Private chat must have exactly 2 participants'));
  }
  next();
});

module.exports = mongoose.model("ChatRoom", chatRoomSchema);