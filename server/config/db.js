// config/db.js
// Connects to MongoDB. If no URI is configured or the connection fails,
// the app still boots — live playback/chat/presence all work in-memory via
// Socket.IO (see socket/roomManager.js) — but chat history and room
// records won't persist across a server restart. This keeps local dev
// possible without requiring Mongo to be running, while production should
// always set MONGODB_URI.

const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      "[db] MONGODB_URI not set — running without persistence. " +
        "Chat history and room records will not survive a restart."
    );
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("[db] Connected to MongoDB");
    return true;
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    console.warn("[db] Continuing without persistence.");
    return false;
  }
}

module.exports = { connectDB };
