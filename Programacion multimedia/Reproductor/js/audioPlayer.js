(function () {
  const audio = document.getElementById("audio");
  const playBtn = document.getElementById("aPlay");
  const seek = document.getElementById("aSeek");
  const vol = document.getElementById("aVol");
  const rate = document.getElementById("aRate");
  const cur = document.getElementById("aCur");
  const dur = document.getElementById("aDur");
  const mask = document.getElementById("waveMask");
  const warn = document.getElementById("audioWarn");

  const titleEl = document.getElementById("trackTitle");
  const artistEl = document.getElementById("trackArtist");

  // Persistencia
  const STORE_KEY = "player_audio_v1";
  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch {
      return {};
    }
  }
  function writeState(patch) {
    const st = readState();
    const next = { ...st, ...patch };
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    return next;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function showWarn(msg) {
    warn.style.display = "block";
    warn.textContent = msg;
  }

  // Dummy track 
  const defaultTrack = {
    title: "0802",
    artist: "Miguel Angel Vargas",
    src: "media/audio/0802.mp3",
  };

  const params = new URLSearchParams(location.search);
  const pickedSrc = params.get("src");
  const pickedTitle = params.get("title");
  const pickedArtist = params.get("artist");

  const track = {
    title: pickedTitle || defaultTrack.title,
    artist: pickedArtist || defaultTrack.artist,
    src: pickedSrc || defaultTrack.src,
  };

  titleEl.textContent = track.title;
  artistEl.textContent = track.artist;
  audio.src = track.src;

  // Controles UI
  playBtn.addEventListener("click", () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  audio.addEventListener("play", () => (playBtn.textContent = "⏸"));
  audio.addEventListener("pause", () => (playBtn.textContent = "▶"));

  vol.addEventListener("input", () => {
    const v = Number(vol.value);
    audio.volume = v;
    if (v > 0) audio.muted = false;
    writeState({ volume: v, muted: audio.muted });
  });

  rate.addEventListener("change", () => {
    const r = Number(rate.value);
    audio.playbackRate = r;
    writeState({ rate: r });
  });

  seek.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const ratio = Number(seek.value) / 1000;
    audio.currentTime = ratio * audio.duration;
  });

  audio.addEventListener("loadedmetadata", () => {
    dur.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

    cur.textContent = formatTime(audio.currentTime);
    seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));

    const progress = audio.currentTime / audio.duration;
    const remaining = 1 - progress;
    mask.style.width = `${clamp(remaining, 0, 1) * 100}%`;
  });

  audio.addEventListener("error", () => {
    showWarn("No se ha podido cargar el audio (revisa media/audio/ y tracks.json).");
  });

  // HOTKEYS
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  function togglePlay() {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function seekBy(deltaSeconds) {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = clamp((audio.currentTime || 0) + deltaSeconds, 0, audio.duration);
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    writeState({ muted: audio.muted });
  }

  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(document.activeElement)) return;

    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
      return;
    }
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      seekBy(-5);
      return;
    }
    if (e.code === "ArrowRight") {
      e.preventDefault();
      seekBy(+5);
      return;
    }
    if (e.key?.toLowerCase() === "m") {
      e.preventDefault();
      toggleMute();
      return;
    }
  });

  // Init + restaurar estado
  (function init() {
    const st = readState();

    // volumen
    const startVol = Number.isFinite(st.volume) ? clamp(st.volume, 0, 1) : 1;
    audio.volume = startVol;
    vol.value = String(startVol);

    // mute
    if (typeof st.muted === "boolean") audio.muted = st.muted;

    // velocidad
    const startRate = Number.isFinite(st.rate) ? clamp(st.rate, 0.5, 2) : 1;
    audio.playbackRate = startRate;
    rate.value = String(startRate);
  })();
})();

