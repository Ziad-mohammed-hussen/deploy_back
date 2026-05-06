const express = require("express");
const router = express.Router();
const authControllers = require("../controllers/authControllers");
const verifyJWT = require("../middleware/verifyJWT");
const passport = require("../config/passport");
const upload = require('../Middleware/upload');
// Auth
router.post("/register/student", authControllers.registerStudent);//done
// بنقوله استقبل ملفين: واحد اسمه cv والتاني اسمه video
router.post(
  '/register/teacher',
  upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  authControllers.registerTeacher
);
router.post("/verify-otp", authControllers.verifyOtp);//done
router.post("/resend-otp", authControllers.resendOtp);
router.post("/login", authControllers.login);//done
router.post("/refresh", authControllers.refresh);
router.get("/me", verifyJWT, authControllers.getMe);//done
router.post("/logout", authControllers.logout);

// Password
router.patch("/change-password", verifyJWT, authControllers.changePassword);//done
router.post("/forget-password", authControllers.forgetPassword);//done
router.post("/verify-reset-code", authControllers.verifyPassResetCode);//done
router.post("/reset-password", authControllers.resetPassword);//done

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  authControllers.googleCallback
);

module.exports = router;