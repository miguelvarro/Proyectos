(function () {
  const KEY = "mp3_store_v1";

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { favorites: {}, notes: {} };
    } catch {
      return { favorites: {}, notes: {} };
    }
  }

  function write(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  window.MP3Store = {
    reset() {
      localStorage.removeItem(KEY);
    },
    isFavorite(id) {
      const st = read();
      return Boolean(st.favorites[id]);
    },
    toggleFavorite(id) {
      const st = read();
      st.favorites[id] = !st.favorites[id];
      write(st);
      return st.favorites[id];
    },
    getNote(id) {
      const st = read();
      return st.notes[id] || "";
    },
    setNote(id, note) {
      const st = read();
      st.notes[id] = String(note || "");
      write(st);
    },
  };
})();

