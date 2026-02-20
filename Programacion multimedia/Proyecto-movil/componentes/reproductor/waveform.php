<?php
// Waveform simple: imagen + barra 
$waveImg = "img/0802.png"; 
?>
<div class="waveBox">
  <img class="waveImg"
       src="<?php echo $waveImg; ?>"
       alt="Waveform"
       onerror="this.style.display='none'; this.parentElement.classList.add('noWave');">

  <div class="waveFallback">
    <div class="waveBar" id="waveBar"></div>
  </div>
</div>

