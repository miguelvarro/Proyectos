import { WSClient } from "./ws_client.js";

const $ = (id) => document.getElementById(id);

const logBox = $("log");
const btnConnect = $("btnConnect");
const btnRender = $("btnRender");
const btnZip = $("btnZip");
const wsUrl = $("wsUrl");

const resultMeta = $("resultMeta");
const downloadLink = $("downloadLink");

let ws = null;

// worker UI
const uiWorker = new Worker("./js/workers/ui_worker.js");
let logItems = [];

uiWorker.onmessage = (e) => {
  if (e.data?.type === "logText") {
    logBox.textContent = e.data.text;
    logBox.scrollTop = logBox.scrollHeight;
  }
};

function pushLog(text){
  const ts = new Date().toLocaleTimeString();
  logItems.push({ ts, text });
  // delega formateo al worker
  uiWorker.postMessage({ type:"formatLog", payload:{ items: logItems.slice(-300) }});
}

function setResult(filename, bytes, mime){
  resultMeta.textContent = `Archivo listo: ${filename} (${bytes.byteLength} bytes)`;
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.textContent = `Descargar ${filename}`;
  downloadLink.classList.remove("hidden");
}

async function loadDefaultScene(){
  // Scene embebida (mismo contenido que backend/scene_default.json)
  return {
    width: 220,
    height: 140,
    samples_per_pixel: 12,
    max_depth: 4,
    camera: { origin:[0,1,3], look_at:[0,0.6,0], fov_degrees:45 },
    world: {
      spheres: [
        { center:[0,0.6,0], radius:0.6, albedo:[0.7,0.3,0.2] },
        { center:[-1,0.4,-0.6], radius:0.4, albedo:[0.2,0.6,0.9] },
        { center:[1,0.5,-0.4], radius:0.5, albedo:[0.2,0.8,0.3] }
      ],
      ground: { y:0.0, albedo:[0.8,0.8,0.8] }
    }
  };
}

btnConnect.onclick = async () => {
  btnConnect.disabled = true;
  downloadLink.classList.add("hidden");
  try {
    ws = new WSClient(wsUrl.value.trim(), (msg) => {
      if (msg.type === "hello") pushLog(`Server: ${msg.server} (${msg.ws})`);
      else if (msg.type === "job") pushLog(`Job ${msg.job_id}: ${msg.status}`);
      else if (msg.type === "progress") pushLog(`Job ${msg.job_id}: ${msg.pct}% - ${msg.msg}`);
      else if (msg.type === "result") {
        pushLog(`Result (${msg.kind}): ${msg.filename}`);
        const bin = Uint8Array.from(atob(msg.data_b64), c => c.charCodeAt(0));
        if (msg.kind === "render") setResult(msg.filename, bin, "image/x-portable-pixmap");
        if (msg.kind === "zip") setResult(msg.filename, bin, "application/zip");
      }
      else if (msg.type === "error") pushLog(`ERROR: ${msg.error}`);
      else if (msg.type === "close") pushLog("WS closed");
      else pushLog(`MSG: ${JSON.stringify(msg)}`);
    });

    await ws.connect();
    pushLog("✅ Connected");
    btnRender.disabled = false;
    btnZip.disabled = false;
  } catch (e) {
    pushLog("❌ Could not connect (is backend running?)");
    btnConnect.disabled = false;
  }
};

btnRender.onclick = async () => {
  if (!ws) return;
  downloadLink.classList.add("hidden");
  const scene = await loadDefaultScene();
  ws.send({ action:"render", scene });
  pushLog("➡️ Render request sent");
};

btnZip.onclick = async () => {
  if (!ws) return;
  downloadLink.classList.add("hidden");
  ws.send({ action:"zip_outputs" });
  pushLog("➡️ ZIP request sent");
};

