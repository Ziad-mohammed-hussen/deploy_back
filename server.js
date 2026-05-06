require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// 1. استدعاء ملف الـ Socket من الفولدر الجديد
const setupChatSocket = require('./socket/chatSocket');

// 2. استدعاء الـ Controllers والـ Routes
const paymentController = require('./controllers/paymentController');
const { getAllCourses } = require('./controllers/adminController');
const authRoutes = require('./routes/authRoute');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/teacherRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const studentRoutes = require('./routes/studentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes'); // تأكد إن المسار لملف الروتس صح
const reviewRoutes = require('./routes/reviewRoutes');
const examRoutes = require('./routes/examRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');
const Teacher = require('./models/Teacher'); // أو حسب اسم الملف عندك
const app = express();
app.use(cors({
  origin: "http://localhost:4200",
  credentials: true
}));

// 3. الـ Webhook (يجب أن يكون قبل express.json)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);
// روت المدرسين Approved مباشرة في السيرفر

app.use(express.json());
app.use(cookieParser());

// 🌍 Language Middleware
app.use((req, res, next) => {
  req.lang = req.headers['accept-language'] || 'en';
  next();
});

// 4. الاتصال بقاعدة البيانات
connectDB();

// 5. إعداد الـ Server و Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
    credentials: true
  }
});
// 6. تشغيل منطق الشات من الملف الخارجي
setupChatSocket(io);
app.get('/api/teachers/public', async (req, res) => {
  console.log("🔍 Fetching public instructors...");
  try {
    const instructors = await Teacher.find({ status: 'approved' })
      .populate('userId', 'firstName lastName profileImage')
      .lean();

    res.json({
      success: true,
      instructors: instructors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// 7. تعريف المسارات (Routes)
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/courses', courseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/student', studentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/exams', examRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.get('/api/public/all-courses', getAllCourses);
// 8. تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.use((err, req, res, next) => {
  console.error("❌ Global Error Handler:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: err
  });
});

server.listen(PORT, () => console.log(`🚀 Server & Socket running on port ${PORT}`));
