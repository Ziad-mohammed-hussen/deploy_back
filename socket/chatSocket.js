const Message = require("../models/Message");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const Notification = require("../models/Notification");
const ChatRoom = require("../models/ChatRoom");
const jwt = require('jsonwebtoken');

module.exports = (io) => {
  console.log("🚀 Socket logic is initialized...");

  // 🔐 Middleware للتحقق من التوكن
  io.use((socket, next) => {
    console.log("------------------------------------------");
    console.log("🔍 Incoming Connection Attempt...");
    
    try {
      // 1. جلب التوكن من الـ Auth object (المرسل من Angular) أو الكوكيز
      let token = socket.handshake.auth?.token;
      
      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie;
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').reduce((acc, curr) => {
            const [key, value] = curr.trim().split('=');
            acc[key] = value;
            return acc;
          }, {});
          token = cookies.jwt;
        }
      }

      if (!token) {
        console.log("❌ Rejected: No token provided");
        return next(new Error("Authentication error: No token"));
      }

      // 2. التحقق من التوكن
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          // محاولة ثانية بالـ Refresh Secret لو التوكن من الكوكيز
          jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err2, decoded2) => {
            if (err2) {
              console.log("❌ Rejected: Invalid token");
              return next(new Error("Authentication error: Invalid token"));
            }
            socket.user = decoded2.userInfo || decoded2;
            next();
          });
          return;
        }

        console.log("✅ Decoded Token Data:", decoded.userInfo || decoded);
        socket.user = decoded.userInfo || decoded;
        next();
      });

    } catch (error) {
      console.log("💥 Crash in Middleware:", error.message);
      next(new Error("Internal Server Error"));
    }
  });

  io.on('connection', (socket) => {
    console.log(`📡 New Socket Established! ID: ${socket.id} | User: ${socket.user.id}`);

    // 👤 private room لكل يوزر
    socket.join(socket.user.id);

    // 🛡️ admin monitoring
    if (socket.user.role === 'admin') {
      socket.join('admin_room');
      console.log(`🛡️ Admin ${socket.user.id} is now monitoring all chats.`);
    }

    // =========================================
    // 🟢 JOIN COURSE ROOM
    // =========================================
    socket.on('join_course', async ({ courseId }) => {
      console.log(`📥 Join Request: User ${socket.user.id} (Role: ${socket.user.role}) wanting course ${courseId}`);

      try {
        // 1. Get Course
        const course = await Course.findById(courseId);
        if (!course) {
          console.log(`❌ Course ${courseId} not found`);
          return socket.emit('access_denied', { msg: "Course not found" });
        }

        // 2. Authorization Logic
        let authorized = false;

        // Admin
        if (socket.user.role === 'admin') {
          authorized = true;
          console.log("🛡️ Admin access granted");
        } 
        // Teacher of the course
        else if (socket.user.role === 'teacher') {
           // We compare user ID with instructorId (which is the User ID in this project's logic)
           if (course.instructorId.toString() === socket.user.id) {
             authorized = true;
             console.log("👨‍🏫 Teacher access granted");
           } else {
             console.log(`🚫 User ${socket.user.id} is teacher but not for this course (${course.instructorId})`);
           }
        }
        // Student enrolled in the course
        else if (socket.user.role === 'student' || !socket.user.role) { // fallback if role is missing but enrollment exists
          const enrollment = await Enrollment.findOne({ 
            studentId: socket.user.id, 
            courseId: courseId,
            isDeleted: false
          });
          if (enrollment) {
            authorized = true;
            console.log("🎓 Student enrollment verified");
          } else {
            console.log(`🚫 Student ${socket.user.id} not enrolled in ${courseId}`);
          }
        }

        if (!authorized) {
          console.log(`❌ User ${socket.user.id} is NOT authorized for course ${courseId}`);
          return socket.emit('access_denied', { msg: "You are not authorized to join this course chat. Please enroll first." });
        }

        // 3. Find or Create ChatRoom
        let room = await ChatRoom.findOne({ courseId: course._id, type: 'courseGroup' });
        
        if (!room) {
          console.log(`🏠 Creating new ChatRoom for course ${course._id}`);
          room = await ChatRoom.create({
            courseId: course._id,
            type: 'courseGroup',
            participants: [socket.user.id]
          });
        } else {
          // تأكد دائماً أن المستخدم في قائمة المشاركين إذا كان مخولاً
          const isParticipant = room.participants.some(p => p.toString() === socket.user.id);
          if (!isParticipant) {
            console.log(`➕ Adding User ${socket.user.id} to participants of room ${room._id}`);
            room.participants.push(socket.user.id);
            await room.save();
          }
        }

        socket.join(room._id.toString());

        socket.emit('access_granted', {
          msg: "Connected to Course Room",
          roomId: room._id
        });

        console.log(`✅ User ${socket.user.id} (${socket.user.role}) joined room ${room._id}`);

      } catch (err) {
        console.log("❌ DB Error in join_course:", err.message);
        socket.emit('error_status', { msg: "حدث خطأ في النظام" });
      }
    });

    // =========================================
    // 💬 SEND MESSAGE
    // =========================================
    socket.on('send_message', async ({ chatRoomId, text, attachments }) => {
      console.log(`💬 New Message from ${socket.user.id} to Room ${chatRoomId}: ${text}`);
      
      try {
        const room = await ChatRoom.findById(chatRoomId);

        if (!room) {
          console.log(`❌ Room ${chatRoomId} not found for message`);
          return socket.emit('error_status', { msg: "Room not found" });
        }

        // السماح بالإرسال إذا كان مشاركاً أو أدمن
        const isParticipant = room.participants.some(
          p => p.toString() === socket.user.id
        ) || socket.user.role === 'admin';

        if (!isParticipant) {
          console.log(`🚫 Unauthorized send attempt by ${socket.user.id}`);
          return socket.emit('error_status', { msg: "Unauthorized to send messages here" });
        }

        // 📝 Create message
        const newMessage = await Message.create({
          chatRoomId,
          senderId: socket.user.id,
          text,
          attachments
        });

        // 📤 Populate sender
        const populatedMessage = await Message.findById(newMessage._id)
          .populate('senderId', 'firstName lastName role');

        // 📡 Send to room
        io.to(chatRoomId).emit('receive_message', populatedMessage);

        // 🔄 Update last message
        await ChatRoom.findByIdAndUpdate(chatRoomId, {
          lastMessage: {
            text,
            senderId: socket.user.id
          },
          lastMessageAt: new Date()
        });

        // 📚 Get course
        const course = await Course.findById(room.courseId);

        // 🔔 Notify teacher
        if (course && course.instructorId.toString() !== socket.user.id) {
          const teacherNotif = await Notification.create({
            recipient: course.instructorId,
            title: {
              ar: "رسالة جديدة",
              en: "New Message"
            },
            message: {
              ar: `رسالة جديدة في كورس ${course.title}`,
              en: `New message in course ${course.title}`
            },
            type: "course",
            referenceModel: "ChatRoom",
            referenceId: chatRoomId
          });

          io.to(course.teacherId.toString()).emit('new_notification', teacherNotif);
        }

        // 🛡️ Admin monitoring
        io.to('admin_room').emit('admin_monitor_message', {
          courseTitle: course?.title,
          senderName: socket.user.name || "User",
          text,
          timestamp: newMessage.createdAt
        });

      } catch (err) {
        console.log("❌ Socket Message Error:", err.message);
        socket.emit('error_status', { msg: "حدث خطأ أثناء إرسال الرسالة" });
      }
    });

    // =========================================
    // 🔴 DISCONNECT
    // =========================================
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User Disconnected. Reason: ${reason}`);
    });
  });
};