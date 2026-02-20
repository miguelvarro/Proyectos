<section class="screen" id="pantalla_player" data-screen="player">
  <header class="topbar">
    <button class="backBtn" data-back="inicio">←</button>
    <div>
      <h2 class="title">Reproductor</h2>
      <p class="muted" id="playerNow">Sin reproducción</p>
    </div>
  </header>

  <div class="playerCard">
    <img id="playerArt" class="playerArt"
         src="img/placeholder.png"
         onerror="this.onerror=null; this.src='img/placeholder.png';"
         alt="Carátula">

  <?php include __DIR__ . "/../reproductor/waveform.php"; ?>

    <div class="playerInfo">
      <h3 id="playerTitle">—</h3>
      <p id="playerAlbum" class="muted">—</p>
    </div>

    <div class="playerControls">
      <button id="btnPrev" type="button">⏮</button>
      <button id="btnToggle" type="button">⏯</button>
      <button id="btnNext" type="button">⏭</button>
      <button id="btnShuffle" type="button">🔀</button>
    </div>

    <div class="playerSeek">
      <input id="seek" type="range" min="0" max="100" value="0">
      <div class="timeRow">
        <span id="tCur">0:00</span>
        <span id="tDur">0:00</span>
      </div>
    </div>

    <div class="playerOptions">
      <label>Velocidad
        <select id="speed">
          <option value="0.75">0.75x</option>
          <option value="1" selected>1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
        </select>
      </label>
      <label>Volumen
        <input id="vol" type="range" min="0" max="1" step="0.01" value="0.9">
      </label>
    </div>
  </div>
</section>

