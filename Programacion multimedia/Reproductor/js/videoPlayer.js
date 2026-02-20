(function () {
  const video = document.getElementById("video");
  const btnPlay = document.getElementById("btnPlay");
  const btnPause = document.getElementById("btnPause");
  const seek = document.getElementById("seek");
  const vol = document.getElementById("vol");
  const cur = document.getElementById("cur");
  const dur = document.getElementById("dur");
  const btnFs = document.getElementById("btnFs");
  const qualitySel = document.getElementById("quality");
  const warn = document.getElementById("videoWarn");
  const container = document.getElementById("videoContainer");

  // Persistencia 
  const STORE_KEY = "player_video_v1";
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

  // Defaults “dummy”
  const defaultRenditions = {
    input_file: "entrevista.mp4",
    renditions: [
      { label: "720p", path: "media/video/entrevista_720p.mp4" },
      { label: "480p", path: "media/video/entrevista_480p.mp4" },
      { label: "360p", path: "media/video/entrevista_360p.mp4" },
    ],
  };

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function showWarn(msg) {
    if (!warn) return;
    warn.style.display = "block";
    warn.textContent = msg;
  }

  function hideWarn() {
    if (!warn) return;
    warn.style.display = "none";
    warn.textContent = "";
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function setSourceKeepTime(src) {
    const t = video.currentTime || 0;
    const wasPlaying = !video.paused;

    video.src = src;
    video.load();

    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = Math.min(t, video.duration || t);
        if (wasPlaying) video.play().catch(() => {});
      },
      { once: true }
    );
  }

  async function loadRenditions() {
    try {
      const r = await fetch("data/video/sources.json", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch {
      return defaultRenditions;
    }
  }

  function fillQuality(renditionsObj) {
    const st = readState();
    qualitySel.innerHTML = "";

    renditionsObj.renditions.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.path;
      opt.textContent = r.label;
      qualitySel.appendChild(opt);
    });

    const last = st.lastQualityPath;
    const hasLast = last && Array.from(qualitySel.options).some((o) => o.value === last);
    qualitySel.value = hasLast ? last : qualitySel.options[0]?.value || "";

    if (qualitySel.value) setSourceKeepTime(qualitySel.value);
  }

  // Controles UI
  btnPlay.addEventListener("click", () => video.play().catch(() => {}));
  btnPause.addEventListener("click", () => video.pause());

  vol.addEventListener("input", () => {
    const v = Number(vol.value);
    video.volume = v;
    if (v > 0) video.muted = false;
    writeState({ volume: v, muted: video.muted });
  });

  seek.addEventListener("input", () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const ratio = Number(seek.value) / 1000;
    video.currentTime = ratio * video.duration;
  });

  video.addEventListener("timeupdate", () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    cur.textContent = formatTime(video.currentTime);
    dur.textContent = formatTime(video.duration);
    seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
  });

  video.addEventListener("loadedmetadata", () => {
    hideWarn();
    cur.textContent = "0:00";
    dur.textContent = formatTime(video.duration);
  });

  video.addEventListener("error", () => {
    showWarn("No se ha podido cargar el vídeo (revisa media/video/ y sources.json).");
  });

  qualitySel.addEventListener("change", () => {
    const path = qualitySel.value;
    writeState({ lastQualityPath: path });
    setSourceKeepTime(path);
  });

  btnFs.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
    }
  });

  // HOTKEYS 
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  function togglePlay() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function seekBy(deltaSeconds) {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = clamp((video.currentTime || 0) + deltaSeconds, 0, video.duration);
  }

  function toggleMute() {
    video.muted = !video.muted;
    writeState({ muted: video.muted });
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await container.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      
    }
  }

  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(document.activeElement)) return;

    // Espacio: play/pause
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
      return;
    }

    // Flechas: seek
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

    // M: mute
    if (e.key?.toLowerCase() === "m") {
      e.preventDefault();
      toggleMute();
      return;
    }

    // F: fullscreen
    if (e.key?.toLowerCase() === "f") {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
  });

  // Init + restaurar estado
  (async () => {
    const st = readState();

    // restaura volumen/mute antes de reproducir
    const startVol = Number.isFinite(st.volume) ? clamp(st.volume, 0, 1) : 1;
    video.volume = startVol;
    vol.value = String(startVol);

    if (typeof st.muted === "boolean") video.muted = st.muted;

    const rend = await loadRenditions();
    fillQuality(rend);

    video.play().catch(() => {});
  })();
})();

