// socket/index.js
// Wires Socket.IO connections to roomManager. Kept separate from server.js
// so the transport layer (Socket.IO) and the state/business logic
// (roomManager) don't get tangled together.

const rm = require("./roomManager");

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    let joinedRoom = null;

    socket.on("create-room", ({ name }, cb) => {
      const { code, room } = rm.createRoom(socket.id, name);
      joinedRoom = code;
      socket.join(code);
      cb({ ok: true, code, isHost: true, state: rm.roomSummary(room) });
    });

    socket.on("join-room", ({ code, name }, cb) => {
      const room = rm.joinRoom(code, socket.id, name);
      if (!room) {
        cb({ ok: false, error: "Room not found. Double-check the code." });
        return;
      }
      joinedRoom = code;
      socket.join(code);
      cb({ ok: true, code, isHost: room.hostId === socket.id, state: rm.roomSummary(room) });
      io.to(code).emit("presence", rm.roomSummary(room).users);
      socket.to(code).emit("system-message", `${name || "Someone"} joined the room.`);
    });

    socket.on("set-video", ({ url }) => {
      const room = rm.getRoom(joinedRoom);
      if (!room || room.hostId !== socket.id) return; // only host may load a video
      rm.setVideo(joinedRoom, url);
      io.to(joinedRoom).emit("video-changed", { url, isPlaying: false, currentTime: 0 });
    });

    socket.on("playback-control", ({ action, time }) => {
      const room = rm.getRoom(joinedRoom);
      if (!room || room.hostId !== socket.id) return; // only host drives playback
      rm.applyPlaybackControl(joinedRoom, action, time);
      socket.to(joinedRoom).emit("playback-control", { action, time });
    });

    socket.on("sync-tick", ({ time, isPlaying }) => {
      const room = rm.getRoom(joinedRoom);
      if (!room || room.hostId !== socket.id) return;
      rm.applySyncTick(joinedRoom, time, isPlaying);
      socket.to(joinedRoom).emit("sync-tick", {
        time,
        isPlaying,
        tolerance: rm.DRIFT_TOLERANCE_SECONDS,
      });
    });

    socket.on("chat-message", ({ text }) => {
      const msg = rm.addChatMessage(joinedRoom, socket.id, text);
      if (msg) io.to(joinedRoom).emit("chat-message", msg);
    });

    socket.on("disconnect", () => {
      if (!joinedRoom) return;
      const { deleted, user, newHostId, room } = rm.removeUser(joinedRoom, socket.id);
      if (deleted) return;

      if (newHostId) io.to(joinedRoom).emit("host-changed", { hostId: newHostId });
      io.to(joinedRoom).emit("presence", rm.roomSummary(room).users);
      if (user) socket.to(joinedRoom).emit("system-message", `${user.name} left the room.`);
    });
  });
}

module.exports = { registerSocketHandlers };
