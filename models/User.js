const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      default: "student",
      required: true,
    },
    googleId: String,
    isVerified: { type: Boolean, default: false }, // حقل أساسي
    verifyOtp: String,
    verifyOtpExpires: Date,
    passwordResetCode: String,
    passwordResetExpires: Date,
    passwordResetverified: Boolean,
    isActive: { type: Boolean, default: true },
    profileImage: { type: String, default: '' },
  },
  { timestamps: true },
);

// تشفير الباسورد قبل الحفظ
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});
// حذف الباسورد من أي JSON بيرجع
userSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);