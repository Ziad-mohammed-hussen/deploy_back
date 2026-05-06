const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Message = require('../models/Message'); // تأكد إنك استدعيت موديل الرسائل

// 1. Endpoint الإشعارات
router.get('/notifications/:userId', async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.params.userId, isRead: false });
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: "Error fetching notifications" });
    }
});

// 2. Endpoint تاريخ الرسائل (تعديل app لـ router)
router.get('/messages/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;

        const messages = await Message.find({ chatRoomId: courseId })
            .sort({ createdAt: 1 }) 
            .populate('senderId', 'name email'); 

        res.status(200).json(messages);
    } catch (err) {
        console.error("❌ Error fetching history:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ✅ التصدير الصحيح
module.exports = router;