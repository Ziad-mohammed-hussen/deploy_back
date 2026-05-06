const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

mongoose.connection.on('connected', async () => {
  const models = ['User', 'Teacher', 'Student', 'Course', 'Enrollment', 'Message'];
  for (const m of models) {
    await mongoose.model(m).createCollection();
  }
  console.log("✅ All Collections are visible in Atlas!");
});

module.exports = connectDB;