const mongoose = require('mongoose');
const metaPlugin = require('../utils/metaPlugin');

// Register metaPlugin globally on Mongoose so all current and future schemas inherit audit tracking
mongoose.plugin(metaPlugin);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
