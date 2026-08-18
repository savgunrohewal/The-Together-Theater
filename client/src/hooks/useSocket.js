// hooks/useSocket.js
// A single Socket.IO connection shared across the whole app (created once,
// reused by whichever page needs it) rather than reconnecting per-component.
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: true });
  }
  return socket;
}
