// static/js/player.js
(function () {
  const audio = document.getElementById("audio");

  // mini
  const miniTitle = document.getElementById("miniTitle");
  const miniSub = document.getElementById("miniSub");
  const miniArt = document.getElementById("miniArt");
  const miniToggle = document.getElementById("miniToggle");
  const miniPlayer = document.getElementById("miniPlayer");

  // full player
  const playerNow = document.getElementById("playerNow");
  const playerTitle = document.getElementById("playerTitle");
  const playerAlbum = document.getElementById("playerAlbum");
  const playerArt = document.getElementById("playerArt");

  const btnPrev = document.getElementById("btnPrev");
  const btnToggle = document.getElementById("btnToggle");
  const btnNext = document.getElementById("btnNext");

  // EXTRAS
  const btnShuffle = document.getElementById("btnShuffle"); // 🔀 (debes añadirlo en pantalla_player.php)
  const waveBar = document.getElementById("waveBar");       // waveform fallback (si incluyes waveform.php)

  const seek = document.getElementById("seek");
  const tCur = document.getElementById("tCur");
  const tDur = document.getElementById("tDur");
  const speed = document.getElementById("speed");
  const vol = document.getElementById("vol");

  let queue = [];
  let idx = -1;
  let isSeeking = false;

  // shuffle
  let shuffle = false;

  function fmt(sec) {
    if (!isFinite(sec)) return "0:00";
    sec = Math.max(0, sec | 0);
    const m = (sec / 60) | 0;
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function safeText(el, v) {
    if (!el) return;
    el.textContent = v ?? "—";
  }

  function safeSrc(imgEl, src) {
    if (!imgEl) return;
    imgEl.src = src || "img/placeholder.png";
  }

  function setMeta(track) {
    const title = track?.song ?? "—";
    const album = track?.album ?? "—";
    const cover = track?.cover ?? "img/placeholder.png";

    safeText(miniTitle, title);
    safeText(miniSub, album);
    safeSrc(miniArt, cover);

    safeText(playerTitle, title);
    safeText(playerAlbum, album);
    safeSrc(playerArt, cover);

    safeText(playerNow, `${title} · ${album}`);
  }

  function loadTrack(i) {
    if (!queue.length) return;
    idx = Math.max(0, Math.min(queue.length - 1, i));
    const track = queue[idx];

    setMeta(track);

    // Reset UI
    if (waveBar) waveBar.style.width = "0%";
    if (seek) seek.value = "0";
    safeText(tCur, "0:00");
    safeText(tDur, "0:00");

    audio.src = track.src || "audio/0802.mp3";
    audio.play().catch(() => {});
  }

  function toggle() {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function prev() {
    if (!queue.length) return;
    loadTrack(idx - 1);
  }

  function next() {
    if (!queue.length) return;

    // shuffle
    if (shuffle && queue.length > 1) {
      let r = idx;
      while (r === idx) r = Math.floor(Math.random() * queue.length);
      loadTrack(r);
      return;
    }

    loadTrack(idx + 1);
  }

  // Eventos UI
  miniToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  btnToggle?.addEventListener("click", toggle);
  btnPrev?.addEventListener("click", prev);
  btnNext?.addEventListener("click", next);

  // botón shuffle
  btnShuffle?.addEventListener("click", () => {
    shuffle = !shuffle;

    btnShuffle.style.background = shuffle ? "var(--accent)" : "";
    btnShuffle.style.color = shuffle ? "#111" : "";
    btnShuffle.style.borderRadius = "14px";
  });

  miniPlayer?.addEventListener("click", () => {
    if (window.Nav?.go) window.Nav.go("player");
  });

  // Eventos audio
  audio.addEventListener("loadedmetadata", () => {
    safeText(tDur, fmt(audio.duration));
  });

  audio.addEventListener("timeupdate", () => {
    const dur = audio.duration || 0;

    if (!isSeeking && dur > 0) {
      const p = (audio.currentTime / dur) * 100;
      if (seek) seek.value = String(p);
      if (waveBar) waveBar.style.width = `${p}%`;
    }

    safeText(tCur, fmt(audio.currentTime));
  });

  audio.addEventListener("ended", () => {
    next();
  });

  // Seek / speed / volume
  seek?.addEventListener("input", () => {
    isSeeking = true;
  });

  seek?.addEventListener("change", () => {
    const p = Number(seek.value) / 100;
    if (audio.duration) audio.currentTime = audio.duration * p;
    isSeeking = false;
  });

  speed?.addEventListener("change", () => {
    audio.playbackRate = Number(speed.value);
  });

  vol?.addEventListener("input", () => {
    audio.volume = Number(vol.value);
  });

  // API global para SpotifyDemo
  window.PlayerQueue = {
    setQueue(tracks) {
      queue = Array.isArray(tracks) ? tracks : [];
      if (queue.length) {
        if (idx === -1) {
          idx = 0;
          setMeta(queue[0]);
          audio.src = queue[0].src || "audio/0802.mp3";
        } else {
          idx = Math.max(0, Math.min(queue.length - 1, idx));
        }
      } else {
        idx = -1;
        setMeta(null);
        audio.removeAttribute("src");
        audio.load();
      }
    },
    playIndex(i) {
      loadTrack(i);
    },
    toggleShuffle(on) {
      shuffle = typeof on === "boolean" ? on : !shuffle;
      if (btnShuffle) {
        btnShuffle.style.background = shuffle ? "var(--accent)" : "";
        btnShuffle.style.color = shuffle ? "#111" : "";
        btnShuffle.style.borderRadius = "14px";
      }
      return shuffle;
    },
    getState() {
      return { idx, size: queue.length, paused: audio.paused, shuffle };
    },
  };

  // Init: carga cola desde lista.json
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("api/lista.json");
      const tracks = await res.json();
      window.PlayerQueue.setQueue(tracks);
    } catch (e) {
    }
  });
})();

