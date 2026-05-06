const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticate, authorizeAdmin } = require("../Middleware/adminMiddleware");

// Use express.raw() for the webhook endpoint to verify Stripe signature
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);
router.post('/checkout', authenticate, paymentController.createCheckoutSession)
// تأكد من استيراد الميدل وير الصح (authenticate أو checkChatAccess)
router.post('/confirm-enrollment', authenticate, paymentController.confirmEnrollmentManually);
router.post(
  "/payments/confirm-enrollment",
  authenticate,
  paymentController.confirmEnrollmentManually
);
module.exports = router;
