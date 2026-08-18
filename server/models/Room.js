// models/Room.js
// Durable record of a room. The *live* playback state (current time,
// who's connected right now, etc.) lives in memory in roomManager.js
// because it changes many times per second and doesn't need a database
// round-trip — this document is the persistent "this room existed, here's
// the last known video and when it was last active" record.

const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    hostName: { type: String, required: true },
    videoUrl: { type: String, default: "" },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
