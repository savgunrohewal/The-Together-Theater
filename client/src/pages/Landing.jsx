import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSocket } from "../hooks/useSocket.js";

export default function Landing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState("join");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState(params.get("room") || "");
  const [createName, setCreateName] = useState("");
  const [error, setError] = useState("");

  function handleCreate(e) {
    e.preventDefault();
    setError("");
    const socket = getSocket();
    socket.emit("create-room", { name: createName.trim() || "Host" }, (res) => {
      if (!res.ok) return setError(res.error || "Could not create room.");
      navigate(`/room/${res.code}`, { state: { isHost: true, name: createName.trim() || "Host" } });
    });
  }

  function handleJoin(e) {
    e.preventDefault();
    setError("");
    const code = joinCode.trim().toUpperCase();
    if (!code) return setError("Enter a room code to join.");
    const socket = getSocket();
    socket.emit("join-room", { code, name: joinName.trim() || "Guest" }, (res) => {
      if (!res.ok) return setError(res.error || "Could not join room.");
      navigate(`/room/${res.code}`, { state: { isHost: false, name: joinName.trim() || "Guest" } });
    });
  }

  return (
    <main className="landing">
      <div className="landing-inner">
        <p className="eyebrow">NOW SCREENING</p>
        <h1 className="marquee-title">
          Watch
          <br />
          Party
        </h1>
        <p className="tagline">
          One screen. Everyone in sync. Nobody has to say "wait, pause."
        </p>

        <div className="card">
          <div className="tabs">
            <button
              className={`tab-btn ${tab === "join" ? "active" : ""}`}
              onClick={() => setTab("join")}
              type="button"
            >
              Join a room
            </button>
            <button
              className={`tab-btn ${tab === "create" ? "active" : ""}`}
              onClick={() => setTab("create")}
              type="button"
            >
              Start a room
            </button>
          </div>

          {tab === "join" ? (
            <form onSubmit={handleJoin}>
              <label htmlFor="join-name">Your name</label>
              <input
                id="join-name"
                type="text"
                placeholder="e.g. Priya"
                maxLength={24}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
              />
              <label htmlFor="join-code">Room code</label>
              <input
                id="join-code"
                type="text"
                placeholder="e.g. A1B2C3"
                maxLength={8}
                style={{ textTransform: "uppercase" }}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                Join room
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreate}>
              <label htmlFor="create-name">Your name</label>
              <input
                id="create-name"
                type="text"
                placeholder="e.g. Priya"
                maxLength={24}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                Create room
              </button>
            </form>
          )}

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </main>
  );
}
