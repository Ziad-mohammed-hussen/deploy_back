const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController'); 

// استيراد authenticate بدلاً من protect
const { authenticate } = require('../middleware/adminMiddleware'); 

// 1. روت الـ Summary
// أي حد مسجل دخول (طالب، مدرس، أدمن) يقدر يشوف قائمة محادثاته
router.get('/summary', authenticate, MessageController.getChatSummary);

// 2. روت الـ History
router.get('/history/:courseId', authenticate, MessageController.getChatHistory);

module.exports = router;