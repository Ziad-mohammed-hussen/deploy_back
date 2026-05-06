const mongoose = require("mongoose");
const Message = require("../models/Message");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const ChatRoom = require("../models/ChatRoom");

exports.getChatSummary = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    let roomFilter = {};
    if (userRole === 'student') {
      roomFilter = { participants: userId };
    } else if (userRole === 'teacher') {
      // المدرس يشوف غرف الكورسات اللي هو بيدرسها
      const Teacher = require('../models/Teacher');
      const Course = require('../models/Course');
      const teacherProfile = await Teacher.findOne({ userId: req.user.id });
      if (teacherProfile) {
        const courses = await Course.find({ instructorId: teacherProfile._id });
        const courseIds = courses.map(c => c._id);
        roomFilter = { courseId: { $in: courseIds } };
      }
    } else if (userRole === 'admin') {
      roomFilter = {}; // الأدمن يشوف كل الغرف
    }

    const summary = await ChatRoom.aggregate([
      { $match: roomFilter },
      // 1. تحويل courseId لـ ObjectId بأمان
      {
        $addFields: {
          courseIdObj: {
            $cond: {
              if: { $eq: [{ $type: "$courseId" }, "string"] },
              then: { $toObjectId: { $trim: { input: "$courseId" } } },
              else: "$courseId"
            }
          }
        }
      },
      // 2. جلب بيانات الكورس
      {
        $lookup: {
          from: 'courses',
          localField: 'courseIdObj',
          foreignField: '_id',
          as: 'courseInfo'
        }
      },
      // 3. الفلترة: لا تظهر الغرفة إذا لم يتم العثور على الكورس الخاص بها
      { $unwind: "$courseInfo" },
      
      // 4. جلب آخر رسالة
      {
        $lookup: {
          from: 'messages',
          localField: '_id',
          foreignField: 'chatRoomId',
          as: 'roomMessages'
        }
      },
      {
        $addFields: {
          lastMsg: { $arrayElemAt: [{ $slice: ["$roomMessages", -1] }, 0] }
        }
      },
      
      // 5. جلب بيانات المرسل لآخر رسالة
      {
        $lookup: {
          from: 'users',
          localField: 'lastMsg.senderId',
          foreignField: '_id',
          as: 'lastSenderInfo'
        }
      },
      {
        $project: {
          _id: 1,
          courseId: 1,
          type: 1,
          courseTitle: "$courseInfo.title",
          lastMessage: "$lastMsg.text",
          lastMessageTime: "$lastMsg.createdAt",
          senderName: {
            $let: {
              vars: { user: { $arrayElemAt: ["$lastSenderInfo", 0] } },
              in: { $concat: [{ $ifNull: ["$$user.firstName", ""] }, " ", { $ifNull: ["$$user.lastName", ""] }] }
            }
          }
        }
      },
      { $sort: { lastMessageTime: -1 } }
    ]);

    res.status(200).json(summary);
  } catch (error) {
    console.error("💥 Summary Error:", error);
    res.status(500).json({ message: "Error fetching summary", error: error.message });
  }
};

// ضيف الدالة دي تحت دالة الـ getChatSummary في ملف Message Controller.js
exports.getChatHistory = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log(`🔍 Fetching history for identifier: ${courseId}`);

    // 1. محاولة إيجاد الغرفة عن طريق الـ courseId
    let room = await ChatRoom.findOne({ 
      courseId: courseId, 
      type: 'courseGroup' 
    });

    // 2. محاولة إضافية: ربما الـ ID المرسل هو الـ _id الخاص بالغرفة مباشرة
    if (!room) {
      room = await ChatRoom.findById(courseId);
    }

    if (!room) {
      console.log(`⚠️ No room found for: ${courseId}`);
      return res.status(200).json([]);
    }

    console.log(`✅ Found Room: ${room._id} for course: ${room.courseId}`);

    // 3. جلب كل الرسائل
    const messages = await Message.find({ chatRoomId: room._id })
      .sort({ createdAt: 1 })
      .populate('senderId', 'firstName lastName role'); 

    console.log(`📬 Found ${messages.length} messages in this room.`);

    res.status(200).json(messages);
  } catch (error) {
    console.error("💥 Error in getChatHistory:", error);
    res.status(500).json({ message: "Error fetching history", error: error.message });
  }
};