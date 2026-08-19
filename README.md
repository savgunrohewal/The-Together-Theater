# The Together Theater

A real-time synced video-watching app, built on the **MERN stack**: MongoDB,
Express, React, Node.js — with Socket.IO for the real-time layer. One person
hosts, everyone else joins with a room code, and playback (play, pause, seek)
stays in sync across every connected browser, alongside live chat and a
presence list.

Built as a portfolio project to demonstrate real-time, stateful systems on
top of a standard MERN foundation — not just CRUD.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 (Vite), React Router, Socket.IO client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB (Mongoose) |
| Real-time transport | WebSockets via Socket.IO |

## Live demo

(https://the-together-theater.vercel.app/)

## Architecture

```
the-together-theater/
├── server/                    # Express + Socket.IO + MongoDB API
│   ├── config/db.js            # Mongo connection (graceful fallback if unset)
│   ├── models/
│   │   ├── Room.js              # Persistent room record
│   │   └── Message.js           # Persistent chat history
│   ├── socket/
│   │   ├── roomManager.js       # Live in-memory room state + async Mongo writes
│   │   └── index.js             # Socket.IO event handlers
│   ├── routes/rooms.js         # REST: GET room info / chat history
│   └── server.js               # Entry point
│
└── client/                    # React (Vite) frontend
    └── src/
        ├── pages/
        │   ├── Landing.jsx      # Create / join a room
        │   └── Room.jsx         # Video sync, chat, presence — the core logic
        ├── components/
        │   └── VideoPlayer.jsx  # Native <video> OR YouTube IFrame, one interface
        ├── hooks/useSocket.js   # Shared Socket.IO client singleton
        └── styles/index.css     # Cinema/marquee visual theme
```

### The interesting part — two-tier state design

This is the thing worth explaining in an interview:

**Live state** (who's connected, current playback position, play/pause) lives
in a plain in-memory `Map` on the server (`roomManager.js`), keyed by room
code. It changes many times per second during playback, and every consumer
is already connected over a WebSocket — round-tripping that through MongoDB
on every tick would add latency for no benefit.

**Durable state** (that a room exists, its last video, the chat transcript)
is written to MongoDB *asynchronously*, off the hot path. A chat message is
broadcast to the room immediately via Socket.IO, and persisted to Mongo in
the background — a slow database write never blocks or delays what other
users see. If MongoDB is unreachable, these writes fail silently and the
live experience is unaffected (see `config/db.js`); only history/persistence
is lost.

This mirrors a common real-world pattern (hot path in memory/cache, async
persistence for durability and history) and is a deliberate choice, not an
oversight — the tradeoffs are worth stating explicitly if asked.

### Sync mechanism (playback)

- Only the room's **host** may control playback. Every play/pause/seek
  action is trusted from the host and relayed to all guests — this avoids
  race conditions from multiple people driving playback independently.
- Every 4 seconds, the host also emits a lightweight `sync-tick` with its
  current time. Guests compare against their own playback position and
  silently re-seek if they've drifted more than 1.2 seconds — this catches
  drift from buffering/network differences that a single discrete
  play/pause event wouldn't fix.
- If the host disconnects, host duties automatically pass to the
  longest-connected remaining guest.

### Two video sources, one interface

`VideoPlayer.jsx` accepts either a **direct video file URL** (`.mp4`, via a
native `<video>` element) or a **YouTube link** (`youtube.com/watch?v=`,
`youtu.be/`, `youtube.com/embed/`, via the YouTube IFrame Player API). Both
are exposed to `Room.jsx` behind the same imperative interface (`currentTime`,
`paused`, `play()`, `pause()`), so the sync logic above doesn't need to know
or care which player is actually running underneath.



**1. Backend**

```bash
cd server
npm install
cp .env.example .env
# edit .env and set MONGODB_URI (or leave unset to run without persistence)
npm run dev
```

**2. Frontend** (in a second terminal)

```bash
cd client
npm install
cp .env.example .env   # only needed if your backend isn't on localhost:5000
npm run dev
```
create a room, then open a second (private/
incognito) tab and join with the room code to see the sync in action.

**Note on video sources:** the host can load either a direct video file URL
(`.mp4`) or a YouTube link. For a quick `.mp4` test, use any public sample
file, e.g. `https://www.w3schools.com/html/mov_bbb.mp4`.

**Running without MongoDB:** the app still boots and the real-time features
(sync, chat, presence) work fully in-memory — you'll see a console warning,
and the two REST history endpoints will return errors, but nothing else is
affected. Good for a quick local demo; set `MONGODB_URI` for anything real.


## Possible extensions



- **WebRTC voice chat** alongside the video.
- **Redis** for live room state instead of an in-memory `Map`, so the app
  can run across multiple server instances behind a load balancer.
- **JWT auth** so room history and named users persist across sessions
  instead of being anonymous per-tab.
- **Reactions** (emoji bursts synced to a timestamp) as a lighter-weight
  alternative to full chat.

## Why this project

Most portfolio CRUD apps show you can move data in and out of a database.
This one shows something different: keeping several independent clients in
agreement about fast-changing shared state, over an unreliable network, in
real time — while still using MongoDB correctly for the data that actually
needs to persist. That combination (hot in-memory path + durable async
writes) is the same shape as the architecture behind collaborative editors,
multiplayer games, and live dashboards.
