window.ARScene = (() => {
  let mounted = false;

  function sceneHTML() {

    return `
      <div class="arOverlay">
        <div class="arBadge">AR.js + A-Frame</div>
        <div class="arHint">Permite la cámara y apunta al marcador <strong>HIRO</strong>.</div>
      </div>

      <a-scene
        embedded
        renderer="colorManagement: true; physicallyCorrectLights: true"
        vr-mode-ui="enabled: false"
        arjs="sourceType: webcam; debugUIEnabled: false; trackingMethod: best;">

        <a-entity light="type: ambient; intensity: 0.6"></a-entity>
        <a-entity light="type: directional; intensity: 0.8" position="0 1 1"></a-entity>

        <a-marker preset="hiro">
          <a-box id="arBox"
            depth="0.5" height="0.5" width="0.5"
            color="#4CC3D9"
            position="0 0.25 0"
            animation="property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear">
          </a-box>

          <a-ring rotation="-90 0 0" radius-inner="0.15" radius-outer="0.2" color="#FFC65D"></a-ring>

          <a-entity position="0 0.8 0"
            text="value: ¡Hola AR.js!; align: center; color: #FFF; width: 2">
          </a-entity>
        </a-marker>

        <a-entity camera></a-entity>
      </a-scene>
    `;
  }

  function mount() {
    if (mounted) return;
    const mountEl = document.getElementById("arMount");
    if (!mountEl) return;

    mountEl.innerHTML = sceneHTML();
    injectLocalOverlayStyles();
    mounted = true;

    // Aplica estado actual
    setObjectColor(window.AppState.state.ar.color);
    setObjectVisible(window.AppState.state.ar.objectVisible);
  }

  function unmount() {
    if (!mounted) return;
    const mountEl = document.getElementById("arMount");
    if (!mountEl) return;

    mountEl.innerHTML = `<div class="hint">AR desactivado.</div>`;
    mounted = false;
  }

  function getBox() {
    return document.querySelector("#arBox");
  }

  function setObjectVisible(visible) {
    const box = getBox();
    if (!box) return;
    box.setAttribute("visible", visible ? "true" : "false");
  }

  function setObjectColor(color) {
    const box = getBox();
    if (!box) return;
    box.setAttribute("color", color);
  }

  function injectLocalOverlayStyles() {
    if (document.getElementById("arOverlayStyles")) return;
    const style = document.createElement("style");
    style.id = "arOverlayStyles";
    style.textContent = `
      .arOverlay{
        position:absolute; left:10px; top:10px; z-index:5;
        display:flex; flex-direction:column; gap:8px;
        pointer-events:none;
      }
      .arBadge{
        background: rgba(0,0,0,.45);
        padding: 6px 8px;
        border-radius: 10px;
        font: 600 12px/1 system-ui, sans-serif;
        letter-spacing:.08em; text-transform:uppercase;
      }
      .arHint{
        background: rgba(0,0,0,.35);
        padding: 8px 10px;
        border-radius: 12px;
        font: 500 13px/1.35 system-ui, sans-serif;
        max-width: 320px;
      }
    `;
    document.head.appendChild(style);
  }

  return {
    mount,
    unmount,
    setObjectVisible,
    setObjectColor
  };
})();

