const mongoose = require('mongoose');

let isConnected = false; // Track connection status

const connectDB = async () => {
    if (isConnected) {
        console.log('=> using existing database connection');
        return;
    }

    try {
        const db = await mongoose.connect(process.env.MONGO_URI);
        isConnected = db.connections[0].readyState === 1;
        console.log(`MongoDB Connected: ${db.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
    }
};

module.exports = connectDB;