// socket/roomManager.js
//
// Two-tier state, on purpose:
//
//  1. LIVE state (this Map) — who's connected, current playback position,
//     play/pause state. This changes constantly (every few seconds during
//     playback) and every consumer is already connected via WebSocket, so
//     there's no reason to round-trip it through MongoDB. It lives in
//     process memory, keyed by room code.
//
//  2. DURABLE state (Room / Message models in MongoDB) — the fact that a
//     room was created, its last known video, and the chat transcript.
//     This is written asynchronously ("fire and forget" from the hot
//     path's perspective) so a slow database write never adds latency to
//     playback sync. If Mongo is unreachable, these writes just fail
//     silently and the live experience is unaffected — see config/db.js.
//
// This mirrors a common real-world pattern: keep the hot path in memory /
// a cache, persist asynchronously for history and durability.

const crypto = require("crypto");
const Room = require("../models/Room");
const Message = require("../models/Message");

const DRIFT_TOLERANCE_SECONDS = 1.2;
const MAX_IN_MEMORY_CHAT = 50;

/** @type {Map<string, RoomState>} */
const rooms = new Map();

function makeRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function userColor(seed) {
  const palette = ["#E3B23C", "#C1443C", "#6FA88C", "#7C9CE3", "#C98BD9", "#E38B4B"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function estimatedCurrentTime(room) {
  if (!room.isPlaying) return room.currentTime;
  const elapsed = (Date.now() - room.lastUpdate) / 1000;
  return room.currentTime + elapsed;
}

function roomSummary(room) {
  return {
    videoUrl: room.videoUrl,
    isPlaying: room.isPlaying,
    currentTime: estimatedCurrentTime(room),
    hostId: room.hostId,
    users: [...room.users.entries()].map(([id, u]) => ({ id, name: u.name, color: u.color })),
    chat: room.chat,
  };
}

function createRoom(hostSocketId, hostName) {
  const code = makeRoomCode();
  const room = {
    hostId: hostSocketId,
    videoUrl: "",
    isPlaying: false,
    currentTime: 0,
    lastUpdate: Date.now(),
    users: new Map([[hostSocketId, { name: hostName || "Host", color: userColor(hostSocketId) }]]),
    chat: [],
  };
  rooms.set(code, room);

  // Durable record — doesn't block the caller.
  Room.create({ code, hostName: hostName || "Host" }).catch((err) =>
    console.error("[roomManager] failed to persist new room:", err.message)
  );

  return { code, room };
}

function getRoom(code) {
  return rooms.get(code);
}

function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return null;
  room.users.set(socketId, { name: name || "Guest", color: userColor(socketId) });
  return room;
}

function setVideo(code, url) {
  const room = rooms.get(code);
  if (!room) return null;
  room.videoUrl = url;
  room.isPlaying = false;
  room.currentTime = 0;
  room.lastUpdate = Date.now();

  Room.updateOne({ code }, { videoUrl: url, lastActiveAt: new Date() }).catch((err) =>
    console.error("[roomManager] failed to persist video change:", err.message)
  );

  return room;
}

function applyPlaybackControl(code, action, time) {
  const room = rooms.get(code);
  if (!room) return null;
  room.currentTime = time;
  room.lastUpdate = Date.now();
  room.isPlaying = action === "play";
  return room;
}

function applySyncTick(code, time, isPlaying) {
  const room = rooms.get(code);
  if (!room) return null;
  room.currentTime = time;
  room.isPlaying = isPlaying;
  room.lastUpdate = Date.now();
  return room;
}

function addChatMessage(code, socketId, text) {
  const room = rooms.get(code);
  if (!room) return null;
  const user = room.users.get(socketId);
  if (!user || !text?.trim()) return null;

  const msg = { name: user.name, color: user.color, text: text.trim().slice(0, 500), ts: Date.now() };
  room.chat.push(msg);
  if (room.chat.length > MAX_IN_MEMORY_CHAT) room.chat.shift();

  Message.create({ roomCode: code, name: msg.name, color: msg.color, text: msg.text }).catch((err) =>
    console.error("[roomManager] failed to persist chat message:", err.message)
  );

  return msg;
}

function removeUser(code, socketId) {
  const room = rooms.get(code);
  if (!room) return { deleted: false };
  const user = room.users.get(socketId);
  room.users.delete(socketId);

  if (room.users.size === 0) {
    rooms.delete(code);
    return { deleted: true, user };
  }

  let newHostId = null;
  if (room.hostId === socketId) {
    newHostId = room.users.keys().next().value;
    room.hostId = newHostId;
  }

  return { deleted: false, user, newHostId, room };
}

module.exports = {
  DRIFT_TOLERANCE_SECONDS,
  createRoom,
  getRoom,
  joinRoom,
  setVideo,
  applyPlaybackControl,
  applySyncTick,
  addChatMessage,
  removeUser,
  roomSummary,
};
