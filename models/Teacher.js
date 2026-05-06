const mongoose = require("mongoose");
const teacherSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  firstName: {
    type: String,
    required: true
  },

  lastName: {
    type: String,
    required: true
  },
  jobTitle: String,

  location: {
    country: String,
    state: String
  },

  phone: String,

  email: String, // optional لو عايز يظهر

  linkedinUrl: String,
  cvUrl: String,

  educationLevel: String,
  specialization: String,

  experienceYears: Number,

  introVideoUrl: String,

  certifications: [String],
 cvLink: { type: String },
  videoLink: { type: String },
  bio: String,
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  }
// array عشان ممكن أكتر من شهادة
  
}, { timestamps: true });

module.exports = mongoose.model("Teacher", teacherSchema);