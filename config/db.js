const mongoose = require('mongoose');

let isConnected = false; // Track connection status

const connectDB = async () => {
    // 1 = connected, 2 = connecting
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        console.log('=> using existing database connection');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
    }
};

module.exports = connectDB;