(function () {
  const btn = document.getElementById("btnThumb");
  const out = document.getElementById("thumbOut");
  const a = document.getElementById("downloadThumb");
  const video = document.getElementById("video");

  if (!btn || !out || !video || !a) return;

  btn.addEventListener("click", () => {
    if (!video.videoWidth || !video.videoHeight) {
      out.innerHTML = "<p class='muted'>Carga el vídeo primero para generar miniaturas.</p>";
      a.style.display = "none";
      return;
    }

    const canvas = document.createElement("canvas");
    const w = 640;
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);

        out.innerHTML = "";
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Miniatura generada";
        out.appendChild(img);

        a.href = url;
        a.style.display = "inline-block";
      },
      "image/jpeg",
      0.9
    );
  });
})();

