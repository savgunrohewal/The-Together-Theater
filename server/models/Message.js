// models/Message.js
// Persisted chat history, keyed by room code so it can be fetched via
// REST when someone loads a room (GET /api/rooms/:code/messages) and so
// history survives a server restart, unlike the old in-memory-only version.

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
