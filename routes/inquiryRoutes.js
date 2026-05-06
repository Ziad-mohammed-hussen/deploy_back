const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiryController');
const { authenticate, authorizeAdmin } = require('../middleware/adminMiddleware');

// Public route to submit inquiry
router.post('/submit', inquiryController.createInquiry);

// Admin routes to manage inquiries
router.get('/', authenticate, authorizeAdmin, inquiryController.getAllInquiries);
router.patch('/:id/status', authenticate, authorizeAdmin, inquiryController.updateInquiryStatus);

module.exports = router;
