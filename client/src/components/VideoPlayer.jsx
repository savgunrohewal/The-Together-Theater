import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Matches youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, with
// any extra query params trailing after the id.
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

// Lazily injects the YouTube IFrame API script once and resolves when
// window.YT is ready, no matter how many players ask for it concurrently.
let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

const VideoPlayer = forwardRef(function VideoPlayer(
  { hasVideo, videoUrl, onPlay, onPause, onSeeked },
  ref
) {
  const youtubeId = extractYouTubeId(videoUrl);

  const videoElRef = useRef(null);
  const ytMountRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const lastKnownTimeRef = useRef(0);
  const pollRef = useRef(null);

  // ---- Expose one interface to Room.jsx regardless of which player is
  // active underneath, so all the existing sync logic keeps working as-is.
  useImperativeHandle(
    ref,
    () => ({
      get currentTime() {
        if (youtubeId) return lastKnownTimeRef.current;
        return videoElRef.current ? videoElRef.current.currentTime : 0;
      },
      set currentTime(t) {
        if (youtubeId) {
          ytPlayerRef.current?.seekTo?.(t, true);
          lastKnownTimeRef.current = t;
        } else if (videoElRef.current) {
          videoElRef.current.currentTime = t;
        }
      },
      get src() {
        return youtubeId ? videoUrl : videoElRef.current?.src;
      },
      set src(url) {
        // For the native player, React doesn't own `src` as a controlled
        // attribute here, so keep supporting direct assignment (Room.jsx
        // does this on join/video-changed). YouTube's "src" is driven by
        // the videoUrl prop instead - swapping players happens in the
        // effect below, so there's nothing to do here for YouTube.
        if (!youtubeId && videoElRef.current) videoElRef.current.src = url;
      },
      get paused() {
        if (youtubeId) {
          const state = ytPlayerRef.current?.getPlayerState?.();
          return state !== window.YT?.PlayerState?.PLAYING;
        }
        return videoElRef.current ? videoElRef.current.paused : true;
      },
      play() {
        if (youtubeId) {
          ytPlayerRef.current?.playVideo?.();
          return Promise.resolve();
        }
        return videoElRef.current?.play() ?? Promise.resolve();
      },
      pause() {
        if (youtubeId) ytPlayerRef.current?.pauseVideo?.();
        else videoElRef.current?.pause();
      },
    }),
    [youtubeId, videoUrl]
  );

  // ---- Mount / tear down the YouTube player whenever we switch to a
  // YouTube URL (or to a different YouTube video).
  useEffect(() => {
    if (!youtubeId) return;
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !ytMountRef.current) return;

      ytPlayerRef.current = new YT.Player(ytMountRef.current, {
        videoId: youtubeId,
        playerVars: { playsinline: 1, controls: 1 },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) onPlay?.();
            else if (e.data === YT.PlayerState.PAUSED) onPause?.();
          },
        },
      });
    });

    // Poll currentTime (YT gives no seek event) so `lastKnownTimeRef`
    // stays fresh for reads, and detect user-dragged seeks on the YT
    // scrubber to fire onSeeked the same way the native <video> does.
    let lastPolled = 0;
    pollRef.current = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player?.getCurrentTime) return;
      const t = player.getCurrentTime();
      lastKnownTimeRef.current = t;
      const drift = Math.abs(t - lastPolled - 0.5);
      if (lastPolled && drift > 1) onSeeked?.();
      lastPolled = t;
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
      ytPlayerRef.current?.destroy?.();
      ytPlayerRef.current = null;
      ytReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  return (
    <div className="video-wrap">
      {youtubeId ? (
        <div ref={ytMountRef} className="youtube-mount" />
      ) : (
        <video
          ref={videoElRef}
          controls
          playsInline
          muted
          defaultMuted
          onPlay={onPlay}
          onPause={onPause}
          onSeeked={onSeeked}
        />
      )}
      {!hasVideo && (
        <div className="no-video-placeholder">
          <p>No film loaded yet.</p>
          <p className="muted-small">
            The host can paste a direct video URL (.mp4) or a YouTube link below.
          </p>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
