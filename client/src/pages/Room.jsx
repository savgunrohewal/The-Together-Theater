import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getSocket } from "../hooks/useSocket.js";
import VideoPlayer from "../components/VideoPlayer.jsx";
import UserList from "../components/UserList.jsx";
import Chat from "../components/Chat.jsx";

export default function Room() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  // suppressRef prevents our own applied (host-driven) changes from being
  // re-emitted as if the user just interacted with the <video> element —
  // avoids an infinite echo loop between host and guests.
  const suppressRef = useRef(false);
  const isHostRef = useRef(Boolean(location.state?.isHost));

  const [isHost, setIsHost] = useState(Boolean(location.state?.isHost));
  const [videoUrl, setVideoUrl] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [copied, setCopied] = useState(false);

  // The name we joined with. Falls back to "Guest" if someone lands
  // directly on a room URL without going through the landing page (e.g.
  // a hard refresh, which drops React Router's navigation state).
  const myNameRef = useRef(location.state?.name || (location.state?.isHost ? "Host" : "Guest"));

  const withSuppression = useCallback((fn) => {
    suppressRef.current = true;
    fn();
    setTimeout(() => (suppressRef.current = false), 50);
  }, []);

  // ---------- Join on mount, and re-join on every reconnect ----------
  useEffect(() => {
    const socket = getSocket();

    function applyState(state) {
      setUsers(state.users);
      setMessages(state.chat.map((m) => ({ ...m, system: false })));
      setVideoUrl(state.videoUrl || "");
      withSuppression(() => {
        if (!videoRef.current) return;
        if (state.videoUrl) {
          videoRef.current.src = state.videoUrl;
          videoRef.current.currentTime = state.currentTime;
          if (state.isPlaying) videoRef.current.play().catch(() => {});
        }
      });
    }

    // Joining is idempotent on the server (Map.set on an existing key just
    // updates it), so it's safe to call this both on the initial mount and
    // every time the socket reconnects — e.g. after a network blip, a dev
    // server restart, or the tab waking from sleep. Without this, a
    // reconnect gets a brand-new socket id and silently falls out of the
    // room even though the UI still looks "connected".
    function joinRoom() {
      socket.emit("join-room", { code, name: myNameRef.current }, (res) => {
        if (res.ok) {
          setIsHost(res.isHost);
          isHostRef.current = res.isHost;
          applyState(res.state);
        } else {
          navigate("/");
        }
      });
    }

    joinRoom();
    socket.on("connect", joinRoom);

    function onVideoChanged({ url, isPlaying, currentTime }) {
      setVideoUrl(url);
      withSuppression(() => {
        if (!videoRef.current) return;
        videoRef.current.src = url;
        videoRef.current.currentTime = currentTime;
        if (isPlaying) videoRef.current.play().catch(() => {});
      });
    }

    function onPlaybackControl({ action, time }) {
      withSuppression(() => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
        if (action === "play") videoRef.current.play().catch(() => {});
        else videoRef.current.pause();
      });
    }

    function onSyncTick({ time, isPlaying, tolerance }) {
      if (!videoRef.current) return;
      const drift = Math.abs(videoRef.current.currentTime - time);
      withSuppression(() => {
        if (drift > tolerance) videoRef.current.currentTime = time;
        if (isPlaying && videoRef.current.paused) videoRef.current.play().catch(() => {});
        if (!isPlaying && !videoRef.current.paused) videoRef.current.pause();
      });
    }

    function onHostChanged({ hostId }) {
      const iAmHost = hostId === socket.id;
      setIsHost(iAmHost);
      isHostRef.current = iAmHost;
    }

    function onPresence(list) {
      setUsers(list);
    }

    function onSystemMessage(text) {
      setMessages((prev) => [...prev, { system: true, text }]);
    }

    function onChatMessage(msg) {
      setMessages((prev) => [...prev, { ...msg, system: false }]);
    }

    socket.on("video-changed", onVideoChanged);
    socket.on("playback-control", onPlaybackControl);
    socket.on("sync-tick", onSyncTick);
    socket.on("host-changed", onHostChanged);
    socket.on("presence", onPresence);
    socket.on("system-message", onSystemMessage);
    socket.on("chat-message", onChatMessage);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("video-changed", onVideoChanged);
      socket.off("playback-control", onPlaybackControl);
      socket.off("sync-tick", onSyncTick);
      socket.off("host-changed", onHostChanged);
      socket.off("presence", onPresence);
      socket.off("system-message", onSystemMessage);
      socket.off("chat-message", onChatMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ---------- Host: periodic sync-tick broadcast ----------
  useEffect(() => {
    const socket = getSocket();
    const interval = setInterval(() => {
      if (!isHostRef.current || !videoRef.current?.src) return;
      socket.emit("sync-tick", {
        time: videoRef.current.currentTime,
        isPlaying: !videoRef.current.paused,
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // ---------- Host: user-driven video element events ----------
  function handlePlay() {
    if (!isHostRef.current || suppressRef.current) return;
    getSocket().emit("playback-control", { action: "play", time: videoRef.current.currentTime });
  }
  function handlePause() {
    if (!isHostRef.current || suppressRef.current) return;
    getSocket().emit("playback-control", { action: "pause", time: videoRef.current.currentTime });
  }
  function handleSeeked() {
    if (!isHostRef.current || suppressRef.current) return;
    getSocket().emit("playback-control", {
      action: videoRef.current.paused ? "pause" : "play",
      time: videoRef.current.currentTime,
    });
  }

  function handleLoadVideo(e) {
    e.preventDefault();
    const url = videoUrlInput.trim();
    if (!url) return;
    getSocket().emit("set-video", { url });
  }

  function handleSendChat(text) {
    getSocket().emit("chat-message", { text });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <main className="room">
      <header className="room-header">
        <div className="room-code-badge">
          <span className="bulb" />
          <span>{code}</span>
          <span className="bulb" />
        </div>
        <button className="btn btn-ghost btn-small" onClick={handleCopyLink} type="button">
          {copied ? "Copied!" : "Copy invite link"}
        </button>
        <div className="spacer" />
        {isHost && <span className="host-tag">You're hosting</span>}
      </header>

      <div className="room-body">
        <section className="screen-area">
          <VideoPlayer
            ref={videoRef}
            hasVideo={Boolean(videoUrl)}
            videoUrl={videoUrl}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeked={handleSeeked}
          />

          {isHost ? (
            <form className="host-controls" onSubmit={handleLoadVideo}>
              <input
                type="text"
                placeholder="Paste a direct video URL (.mp4) or a YouTube link"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
              />
              <button className="btn btn-primary btn-small" type="submit">
                Load
              </button>
            </form>
          ) : (
            <p className="muted-small">
              Playback is controlled by the host — you're synced automatically.
            </p>
          )}
        </section>

        <aside className="side-panel">
          <UserList users={users} />
          <Chat messages={messages} onSend={handleSendChat} />
        </aside>
      </div>
    </main>
  );
}
