window.App = (() => {
  const S = window.AppState;

  function disableAllCamera() {
    // apaga manos y AR (libera cámara)
    enableHands(false);
    enableAR(false);
    S.setCameraMode("NONE");
  }

  function enableHands(on) {
    if (on) {
      // Si AR estaba activo, lo apagamos antes (cámara exclusiva)
      if (S.state.ar.enabled) enableAR(false);

      S.state.hands.enabled = true;
      S.setCameraMode("HANDS");
      S.ui.sync();

      window.MPHands.start().catch(err => {
        console.warn("No se pudo iniciar MediaPipe:", err);
        S.state.hands.enabled = false;
        S.setCameraMode("NONE");
        S.ui.sync();
      });
    } else {
      S.state.hands.enabled = false;
      S.ui.sync();
      window.MPHands.stop();
      if (S.state.cameraMode === "HANDS") S.setCameraMode("NONE");
    }
  }

  function enableAR(on) {
    if (on) {
      // Si manos estaba activo, lo apagamos antes (cámara exclusiva)
      if (S.state.hands.enabled) enableHands(false);

      S.state.ar.enabled = true;
      S.setCameraMode("AR");
      S.ui.sync();

      window.ARScene.mount();
      // Aplica estado
      S.arSetColor(S.state.ar.color);
      S.arSetVisible(S.state.ar.objectVisible);
    } else {
      S.state.ar.enabled = false;
      S.ui.sync();
      window.ARScene.unmount();
      if (S.state.cameraMode === "AR") S.setCameraMode("NONE");
    }
  }

  function wireUI() {
    const btnVoice = document.getElementById("btnVoice");
    const btnHands = document.getElementById("btnHands");
    const btnAR = document.getElementById("btnAR");
    const btnStopAll = document.getElementById("btnStopAll");

    btnVoice?.addEventListener("click", () => window.Voice.start());

    btnHands?.addEventListener("click", () => {
      enableHands(!S.state.hands.enabled);
    });

    btnAR?.addEventListener("click", () => {
      enableAR(!S.state.ar.enabled);
    });

    btnStopAll?.addEventListener("click", () => {
      disableAllCamera();
    });
  }

  function init() {
    S.ui.sync();
    wireUI();
    window.Voice.init();

    // estado inicial
    S.setCameraMode("NONE");
  }

  return { init, enableHands, enableAR };
})();

window.addEventListener("DOMContentLoaded", () => {
  window.App.init();
});

