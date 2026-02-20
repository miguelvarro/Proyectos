(function () {
  const list = document.getElementById("list");
  const warn = document.getElementById("libWarn");
  const btnReset = document.getElementById("btnReset");

  function showWarn(msg) {
    warn.style.display = "block";
    warn.textContent = msg;
  }

  async function loadTracks() {
    try {
      const r = await fetch("data/tracks.json", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch {
      return [
        { id: "t1", title: "Tema demo", artist: "Artista demo", src: "media/audio/demo.mp3" },
      ];
    }
  }

  function renderTrack(t) {
    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "top";

    const left = document.createElement("div");
    const h4 = document.createElement("h4");
    h4.textContent = t.title;
    const p = document.createElement("p");
    p.textContent = t.artist || "—";
    left.appendChild(h4);
    left.appendChild(p);

    const right = document.createElement("div");
    right.className = "row";

    const fav = document.createElement("button");
    fav.className = "btn";
    const setFavUI = () => {
      const on = window.MP3Store.isFavorite(t.id);
      fav.textContent = on ? "★ Favorito" : "☆ Favorito";
      fav.classList.toggle("primary", on);
    };
    setFavUI();

    fav.addEventListener("click", () => {
      window.MP3Store.toggleFavorite(t.id);
      setFavUI();
    });

    const open = document.createElement("a");
    open.className = "btn";
    open.textContent = "Abrir en player";
    const u = new URL("audio.html", location.href);
    u.searchParams.set("src", t.src || "");
    u.searchParams.set("title", t.title || "");
    u.searchParams.set("artist", t.artist || "");
    open.href = u.toString();

    right.appendChild(fav);
    right.appendChild(open);

    top.appendChild(left);
    top.appendChild(right);

    const ta = document.createElement("textarea");
    ta.placeholder = "Notas (se guardan en localStorage)…";
    ta.value = window.MP3Store.getNote(t.id);

    let timer = null;
    ta.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.MP3Store.setNote(t.id, ta.value);
      }, 250);
    });

    div.appendChild(top);
    div.appendChild(ta);
    return div;
  }

  btnReset.addEventListener("click", () => {
    window.MP3Store.reset();
    location.reload();
  });

  (async () => {
    const tracks = await loadTracks();
    if (!Array.isArray(tracks) || tracks.length === 0) {
      showWarn("tracks.json está vacío o no es un array.");
      return;
    }
    list.innerHTML = "";
    tracks.forEach((t) => list.appendChild(renderTrack(t)));
  })();
})();

