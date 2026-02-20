<section id="miniPlayer" class="miniPlayer" aria-label="Mini reproductor">
  <div class="miniLeft">
    <img id="miniArt" src="img/placeholder.png"
         onerror="this.onerror=null; this.src='img/placeholder.png';" alt="Carátula">
    <div class="miniText">
      <h3 id="miniTitle">—</h3>
      <p id="miniSub" class="muted">—</p>
    </div>
  </div>

  <div class="miniRight">
    <button id="miniToggle" type="button" aria-label="Play/Pause">⏯</button>
  </div>

  <!-- Audio REAL -->
  <audio id="audio" preload="metadata"></audio>
</section>

