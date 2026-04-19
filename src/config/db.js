const mongoose = require("mongoose");

async function connectDB() {
  // Ensure we are pulling from process.env correctly
  const uri = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : null;
  
  if (!uri) {
    console.error(
      "Error connecting to MongoDB: MONGO_URI is not set or is empty.",
    );
    process.exit(1);
  }

  try {
    // FIXED: Added a check to prevent multiple heartbeats/connections if this is called twice
    if (mongoose.connection.readyState === 1) {
      return;
    }

    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;