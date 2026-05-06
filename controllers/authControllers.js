const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// ==================== generateTokens ====================

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userInfo: { id: user._id, role: user.role } },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign(
    { userInfo: { id: user._id, role: user.role } },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "30d" },
  );
  return { accessToken, refreshToken };
};
//==================== Sending Email ====================

const sendEmail = async (options) => {
  console.log("=========================================");
  console.log(`📧 Simulation Email to: ${options.email}`);
  console.log(`💬 Message: ${options.message}`);
  console.log("=========================================");
  // لو معندكش بيانات إيميل في الـ .env، السيرفر مش هيقف ولا هيطلع Error
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log("⚠️ No Email config found. Skipping real mail sending.");
    return; 
  }
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: "EduLearn app",
    to: options.email,
    subject: options.subject,
    text: options.message,
  });
};
// ==================== Register Student ====================

const registerStudent = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const userFound = await User.findOne({ email }).exec();
    if (userFound)
      return res.status(400).json({ message: "User already exists" });

    // OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: "student",
      verifyOtp: hashedOtp,
      verifyOtpExpires: Date.now() + 10 * 60 * 1000,
    });

    // create student profile
    await Student.create({
      userId: user._id,
      firstName,
      lastName,
      phone,
    });

    // send email
    await sendEmail({
      email: user.email,
      subject: "Email Verification OTP",
      message: `Hi ${user.firstName},\n\nYour verification code is: ${otp}\n\nValid for 10 minutes.\n\nEduLearn Team`,
    });

    res.status(201).json({
      message: "Student registered! Check your email for OTP.",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ==================== Register Teacher ====================

const registerTeacher = async (req, res) => {
  try {
  const { 
      firstName, 
      lastName, 
      email, 
      password, 
      phone, 
      specialization,
      jobTitle,         // ضيفنا دول هنا
      experienceYears, 
      location, 
      linkedinUrl, 
      educationLevel, 
      certifications 
    } = req.body;
    const cvUrl = req.files?.['cv']?.[0]?.path;
    const videoUrl = req.files?.['video']?.[0]?.path;
    if (!firstName||!lastName || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const userFound = await User.findOne({ email }).exec();
    if (userFound)
      return res.status(400).json({ message: "User already exists" });

    // OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
     
    // create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: "teacher",
      verifyOtp: hashedOtp,
      verifyOtpExpires: Date.now() + 10 * 60 * 1000,
    });

    // create teacher profile
    await Teacher.create({
      userId: user._id,
      firstName,
      lastName,
      phone,
      specialization,
      status: "pending",
      jobTitle,
      experienceYears,
      location,
      linkedinUrl,
      cvLink: cvUrl,
      videoLink: videoUrl,
      educationLevel,
      certifications,
    });

    // send email
    await sendEmail({
      email: user.email,
      subject: "Email Verification OTP",
      message: `Hi ${user.firstName},\nYour verification code is: ${otp}\nValid for 10 minutes.\nEduLearn Team`,
    });

    res.status(201).json({
      message: "Teacher registered! Wait for approval after verification.",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ==================== Verify OTP ====================

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "All fields are required" });

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.findOne({
      email,
      verifyOtp: hashedOtp,
      verifyOtpExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "OTP is invalid or expired" });

    // تأكيد الإيميل
    user.isVerified = true;
    user.verifyOtp = undefined;
    user.verifyOtpExpires = undefined;
    await user.save();

    // بعت التوكنز
    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Email verified successfully!",
      accessToken,
      firstName: user.firstName,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==================== Resend OTP ====================

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isVerified)
      return res.status(400).json({ message: "Email already verified" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    user.verifyOtp = hashedOtp;
    user.verifyOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendEmail({
      email: user.email,
      subject: "Resend Verification OTP",
      message: `Hi ${user.firstName},\nYour new verification code is: ${otp}\nValid for 10 minutes.\nEduLearn Team`,
    });

    res.json({ message: "OTP resent successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==================== Login ====================

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const user = await User.findOne({ email }).exec();
    if (!user) return res.status(401).json({ message: "User does not exist" });

    // Google users
    if (!user.password)
      return res.status(401).json({ message: "Please login with Google" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Wrong password" });

    // verify email
    if (!user.isVerified)
      return res
        .status(403)
        .json({ message: "Please verify your email first" });

    // Teacher approval check
    if (user.role === "teacher") {
      const teacher = await Teacher.findOne({ userId: user._id });

      if (!teacher)
        return res.status(404).json({ message: "Teacher profile not found" });

      if (teacher.status === "pending") {
        return res.status(403).json({
          message: "Your account is under review",
        });
      }

      if (teacher.status === "rejected") {
        return res.status(403).json({
          message: "Your account was rejected",
        });
      }
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      userId: user._id, // ده "المفتاح" اللي هيربطنا بـ Socket.io
      role: user.role,  // عشان نفرق بين شاشة المدرس والطالب
      firstName: user.firstName,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ==================== Refresh Token ====================

const refresh = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.status(401).json({ message: "Unauthorized" });

  const refreshToken = cookies.jwt;
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Forbidden" });
      const user = await User.findById(decoded.userInfo.id).exec();
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const accessToken = jwt.sign(
        { userInfo: { id: user._id, role: user.role } },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "30d" },
      );
      res.json({ accessToken });
    },
  );
};

// ==================== Get Me ====================

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==================== Logout ====================

const logout = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204);
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
  });
  res.json({ message: "Logged out successfully" });
};

// ==================== Change Password ====================

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res.status(400).json({ message: "All fields are required" });

    const user = await User.findById(req.user).exec();
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(401).json({ message: "Wrong password" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==================== Forget Password ====================

const forgetPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedResetCode = crypto
      .createHash("sha256")
      .update(resetCode)
      .digest("hex");

    user.passwordResetCode = hashedResetCode;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    user.passwordResetverified = false;
    await user.save();

    await sendEmail({
      email: user.email,
      subject: "Password Reset Code (valid for 10 min)",
      message: `Hi ${user.firstName},\nYour password reset code is: ${resetCode}\nValid for 10 minutes.\nEduLearn Team`,
    });

    res.json({ message: "Reset code sent to email" });
  } catch (err) {
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetverified = undefined;
    await user.save();
    res.status(500).json({ message: "Error sending email" });
  }
};

// ==================== Verify Reset Code ====================

const verifyPassResetCode = async (req, res) => {
  try {
    const hashedResetCode = crypto
      .createHash("sha256")
      .update(req.body.resetCode)
      .digest("hex");
    const user = await User.findOne({
      passwordResetCode: hashedResetCode,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user)
      return res
        .status(401)
        .json({ message: "Reset code is invalid or expired" });

    user.passwordResetverified = true;
    await user.save();

    res.json({ status: "Reset code is true" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==================== Reset Password ====================

const resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.passwordResetverified)
      return res.status(400).json({ message: "Reset code not verified" });

    user.password = req.body.newPassword;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetverified = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==================== Google Callback ====================

const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?token=${accessToken}`,
    );
  } catch (err) {
    res.status(500).json({ message: "Google login failed" });
  }
};

// ==================== Exports ====================

module.exports = {
  registerStudent,
  registerTeacher,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  getMe,
  changePassword,
  forgetPassword,
  sendEmail,
  verifyPassResetCode,
  resetPassword,
  googleCallback,
};