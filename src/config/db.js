const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : null;
  
  if (!uri) {
    console.error("Error: MONGO_URI is not set or is empty in env.");
    return connectLocalFallback();
  }

  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // 5 seconds selection timeout
    });
    console.log("Connected to MongoDB Atlas");
  } catch (err) {
    console.error("Error connecting to MongoDB Atlas:", err.message);
    await connectLocalFallback();
  }
}

async function connectLocalFallback() {
  const localUri = "mongodb://127.0.0.1:27017/bank-ledger";
  try {
    console.log(`Attempting Local Fallback: ${localUri}...`);
    if (mongoose.connection.readyState === 1) {
      return;
    }
    await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 3000 // 3 seconds timeout
    });
    console.log("Connected to Local MongoDB database!");
  } catch (localErr) {
    console.error("❌ Local MongoDB fallback also failed.");
    console.error("═══════════════════════════════════════════════════");
    console.error("  ⚠️  DATABASE IS OFFLINE!");
    console.error("  Express server will stay online, but API database");
    console.error("  requests might timeout or fail.");
    console.error("  Please make sure local MongoDB service is running.");
    console.error("═══════════════════════════════════════════════════");
  }
}

module.exports = connectDB;