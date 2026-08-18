// routes/rooms.js
// Read-only REST endpoints backed by MongoDB. These are separate from the
// Socket.IO real-time path on purpose: a client loading the room page can
// fetch "did this room ever exist / what was the chat history" over plain
// HTTP before or independently of opening a WebSocket connection.

const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Message = require("../models/Message");

// GET /api/rooms/:code - basic room record (404 if it never existed)
router.get("/:code", async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: "Could not look up room. Is MongoDB connected?" });
  }
});

// GET /api/rooms/:code/messages - chat history for a room (most recent 100)
router.get("/:code/messages", async (req, res) => {
  try {
    const messages = await Message.find({ roomCode: req.params.code.toUpperCase() })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: "Could not load chat history. Is MongoDB connected?" });
  }
});

module.exports = router;
