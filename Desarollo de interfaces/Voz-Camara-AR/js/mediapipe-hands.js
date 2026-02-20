window.MPHands = (() => {
  let hands = null;
  let running = false;
  let stream = null;
  let rafId = null;

  const video = () => document.getElementById("mpVideo");
  const canvas = () => document.getElementById("mpCanvas");

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  // Gesto MUY simple:
  // - "PUÑO": tips cerca de la palma (MCP)
  // - "MANO ABIERTA": tips lejos de la palma
  function detectGesture(landmarks) {
    // Índices (MediaPipe Hands)
    // 0: wrist
    // 5: index_mcp, 9: middle_mcp, 13: ring_mcp, 17: pinky_mcp
    // 8: index_tip, 12: middle_tip, 16: ring_tip, 20: pinky_tip
    const palm = landmarks[0];
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];

    const avg = tips.reduce((acc, p) => acc + distance(palm, p), 0) / tips.length;

    // Umbral relativo (en coords normalizadas)
    if (avg < 0.28) return "PUÑO";
    if (avg > 0.38) return "MANO ABIERTA";
    return "MANO";
  }

  function draw(results) {
    const c = canvas();
    const ctx = c.getContext("2d");

    ctx.save();
    ctx.clearRect(0, 0, c.width, c.height);

    // Fondo: el frame de cámara
    ctx.drawImage(results.image, 0, 0, c.width, c.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS);
        drawLandmarks(ctx, landmarks, { radius: 2 });

        const g = detectGesture(landmarks);
        window.AppState.setGesture(g);

        // Control por gesto (opcional y simple):
        // Mano abierta -> mostrar cubo, Puño -> ocultar cubo
        if (window.AppState.state.ar.enabled) {
          if (g === "MANO ABIERTA") window.AppState.arSetVisible(true);
          if (g === "PUÑO") window.AppState.arSetVisible(false);
        }
      }
    } else {
      window.AppState.setGesture("—");
    }

    ctx.restore();
  }

  async function start() {
    if (running) return;
    running = true;

    // 1) webcam propia (para poder parar bien)
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video().srcObject = stream;

    // 2) hands setup (igual al ejemplo)
    hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults(draw);

    // 3) loop de envío de frames
    const loop = async () => {
      if (!running) return;
      await hands.send({ image: video() });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (video()) video().srcObject = null;

    window.AppState.setGesture("—");
  }

  return { start, stop };
})();

