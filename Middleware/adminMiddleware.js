const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 1) التحقق من الـ Token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
console.log("Payload content:", decoded); // السطر ده هيحل اللغز
   // هنقرأ الـ id من جوه الـ userInfo
const user = await User.findById(decoded.userInfo.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // لو teacher وحسابه لسه pending
    if (user.role === "teacher" && !user.isActive) {
      return res.status(403).json({
        message: "Account pending admin approval",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// 2) التحقق إن الـ user ده admin
const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  next();
};
const authorizeTeacher = (req, res, next) => {
  if (req.user.role !== "teacher" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Teachers only." });
  }
  next();
};

module.exports = { authenticate, authorizeAdmin ,authorizeTeacher };