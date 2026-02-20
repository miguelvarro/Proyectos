(function(){
  const grid = document.getElementById("favoritasGrid");
  const favTitle = document.getElementById("favTitle");
  const favCover = document.getElementById("favCover");
  const songsList = document.getElementById("songsList");
  const btnPlayAll = document.getElementById("btnPlayAll");

  let cacheSongs = [];

  async function loadFavorites(){
    const res = await fetch("api/favoritos.json");
    const data = await res.json();

    grid.innerHTML = "";
    data.favorites.forEach((fav) => {
      const tpl = document.getElementById("tpl_favorito");
      const node = tpl.content.cloneNode(true);
      const card = node.querySelector(".favCard");
      card.querySelector("img").src = fav.image;
      card.querySelector(".favTitle").textContent = fav.artist;

      card.addEventListener("click", () => {
        favTitle.textContent = fav.artist;
        favCover.src = fav.image;
        Nav.go("favoritos");
      });

      grid.appendChild(node);
    });
  }

  async function loadSongs(){
    const res = await fetch("api/lista.json");
    cacheSongs = await res.json();

    songsList.innerHTML = "";
    cacheSongs.forEach((s, i) => {
      const tpl = document.getElementById("tpl_cancion");
      const node = tpl.content.cloneNode(true);
      node.querySelector(".songTitle").textContent = s.song;
      node.querySelector(".songAlbum").textContent = s.album;

      const playBtn = node.querySelector(".songPlay");
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.PlayerQueue.playIndex(i);
        Nav.go("player");
      });

      node.querySelector(".songRow").addEventListener("click", () => {
        window.PlayerQueue.playIndex(i);
        Nav.go("player");
      });

      songsList.appendChild(node);
    });
  }

  btnPlayAll?.addEventListener("click", () => {
    window.PlayerQueue.playIndex(0);
    Nav.go("player");
  });

  window.SpotifyDemo = { loadFavorites, loadSongs };

  document.addEventListener("DOMContentLoaded", async () => {
    await loadFavorites();
    await loadSongs();
  });
})();

