// server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { connectDB } = require("./config/db");
const roomsRouter = require("./routes/rooms");
const { registerSocketHandlers } = require("./socket");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

async function start() {
  await connectDB();

  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/rooms", roomsRouter);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: CLIENT_ORIGIN },
  });

  registerSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(`Watch Party API + WebSocket server running on http://localhost:${PORT}`);
  });
}

start();
