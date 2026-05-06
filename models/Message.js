const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatRoomId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "ChatRoom", 
    required: true 
  },

  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  text: { type: String },

  attachments: [
    {
      url: String,
      type: { type: String, enum: ["image", "video", "file"] }
    }
  ],

  isReadBy: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    default: []
  }],

  isDeleted: { type: Boolean, default: false },

  replyTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Message" 
  }

}, { timestamps: true });

// 🔥 Performance
messageSchema.index({ chatRoomId: 1, createdAt: -1 });

// ✅ Validation
messageSchema.pre('save', function(next) {
  if (!this.text && (!this.attachments || this.attachments.length === 0)) {
    return next(new Error('Message must have text or attachment'));
  }
  next();
});

module.exports = mongoose.model("Message", messageSchema);