<section class="screen" id="pantalla_favoritos" data-screen="favoritos">
  <header class="topbar">
    <button class="backBtn" data-back="inicio">←</button>
    <div>
      <h2 class="title" id="favTitle">Favoritos</h2>
      <p class="muted" id="favSubtitle">Lista de canciones</p>
    </div>
  </header>

  <div class="coverRow">
    <img id="favCover" class="cover"
         src="img/placeholder.png"
         onerror="this.onerror=null; this.src='img/placeholder.png';"
         alt="Portada">
    <div class="coverMeta">
      <p class="muted">Toca una canción para reproducir</p>
      <button class="primaryBtn" id="btnPlayAll" type="button">Reproducir todo</button>
    </div>
  </div>

  <div id="songsList" class="list"></div>
</section>

