const mongoose = require('mongoose');
const User = require('./models/User');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const messageRoutes = require('./routes/messageRoutes'); // تأكد من المسار صح

mongoose.connect('mongodb+srv://omarsohag2007_db_user:25hCsj9bXc4Fh7Mp@cluster0.bejjura.mongodb.net/?appName=Cluster0');
app.use('/api', messageRoutes);
const seedData = async () => {
    // 1. كارييت مدرس
    const teacher = await User.create({ email: "teacher@test.com", role: "teacher" });
    
    // 2. كارييت طالب
    const student = await User.create({ email: "omar@test.com", role: "student" });

    // 3. كارييت كورس
    const course = await Course.create({ 
        title: "Node.js Course", 
        instructorId: teacher._id,
        sections: [] 
    });

    // 4. سجل الطالب في الكورس (Enrollment)
    await Enrollment.create({ studentId: student._id, courseId: course._id });

    console.log("Done! Use these IDs to test:");
    console.log("Student ID:", student._id);
    console.log("Course ID:", course._id);
    process.exit();
};

seedData();

// استيراد الراوتر


// استخدامه كـ Middleware
