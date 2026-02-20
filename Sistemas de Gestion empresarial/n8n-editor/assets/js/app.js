import { Store, NodeTypes } from "./store.js";
import { enableNodeDrag } from "./drag.js";
import { initConnectors, drawAllWires } from "./connectors.js";
import { saveWorkflow, loadWorkflow } from "./api.js";
import { runWorkflow, validateWorkflow } from "./engine.js";

const workspace = document.getElementById("workspace");
const canvas = document.getElementById("canvas");
const wires = document.getElementById("wires");
const statusEl = document.getElementById("status");
const runLogEl = document.getElementById("runLog");

// sidebar
const btnDeleteNode = document.getElementById("btnDeleteNode");
const propId = document.getElementById("propId");
const propName = document.getElementById("propName");
const propType = document.getElementById("propType");
const propConfig = document.getElementById("propConfig");
const propConfigHelp = document.getElementById("propConfigHelp");

let selectedNodeId = null;

// view
const view = { x: 0, y: 0, scale: 1 };

// pan state
let spaceDown = false;
let isPanning = false;
let panStart = { mx: 0, my: 0, x: 0, y: 0 };
let didPan = false;

function setStatus(msg){ statusEl.textContent = msg || ""; }
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function clone(obj){
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function applyView(){
  canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  renderWires();
}

function screenToWorld(clientX, clientY){
  return { x: (clientX - view.x) / view.scale, y: (clientY - view.y) / view.scale };
}

function portsHtml(node){
  const ins = node.ports.inputs.map(p => `
    <div class="portRow">
      <div class="port" data-kind="in" data-port="${p.id}" title="${p.id}"></div>
      <span class="portLabel">${escapeHtml(p.label ?? p.id)}</span>
    </div>
  `).join("");

  const outs = node.ports.outputs.map(p => `
    <div class="portRow" style="justify-content:flex-end;">
      <span class="portLabel">${escapeHtml(p.label ?? p.id)}</span>
      <div class="port" data-kind="out" data-port="${p.id}" title="${p.id}"></div>
    </div>
  `).join("");

  return `
    <div class="ports2">
      <div class="portsCol">${ins || `<div class="portLabel">(sin inputs)</div>`}</div>
      <div class="portsCol">${outs || `<div class="portLabel">(sin outputs)</div>`}</div>
    </div>
  `;
}

function nodeTemplate(node){
  return `
    <div class="node ${node.id === selectedNodeId ? "selected" : ""}" data-node-id="${node.id}" style="left:${node.x}px; top:${node.y}px;">
      <div class="node__header">
        <div class="node__title">
          <span>${escapeHtml(node.name)}</span>
          <span class="badge">${escapeHtml(node.type)}</span>
        </div>
        <span class="portLabel">⋮</span>
      </div>

      <div class="node__body">
        <div class="row">
          <span>Entradas</span>
          <span>Salidas</span>
        </div>
        ${portsHtml(node)}
      </div>
    </div>
  `;
}

function selectNode(id){
  selectedNodeId = id;
  syncSidebar();
  render();
}

function syncSidebar(){
  const node = selectedNodeId ? Store.state.nodes[selectedNodeId] : null;

  const enabled = !!node;
  btnDeleteNode.disabled = !enabled;
  propName.disabled = !enabled;
  propType.disabled = !enabled;
  propConfig.disabled = !enabled;

  if (!node){
    propId.value = "(ninguno)";
    propName.value = "";
    propType.value = "generic";
    propConfig.value = "";
    propConfigHelp.textContent = "";
    return;
  }

  propId.value = node.id;
  propName.value = node.name ?? "";
  propType.value = node.type ?? "generic";
  propConfig.value = JSON.stringify(node.config ?? {}, null, 2);
  propConfigHelp.textContent = "";
}

function render(){
  canvas.innerHTML = Object.values(Store.state.nodes).map(nodeTemplate).join("");

  document.querySelectorAll(".node").forEach(nodeEl => {
    const id = nodeEl.dataset.nodeId;

    nodeEl.addEventListener("mousedown", (ev) => {
      if (spaceDown) return;
      selectNode(id);
    });

    enableNodeDrag(nodeEl, {
      getPos(){
        const n = Store.state.nodes[id];
        return { x: n.x, y: n.y };
      },
      setPos({ x, y }){
        nodeEl.style.left = `${x}px`;
        nodeEl.style.top  = `${y}px`;
        Store.updateNode(id, { x, y });
        renderWires();
      },
      getScale(){
        return view.scale;
      },
      onDragEnd(){
        renderWires();
      }
    });

    connectors.bindNodePorts(nodeEl);
  });

  renderWires();
}

function renderWires(){
  drawAllWires({
    wiresSvg: wires,
    store: Store,
    onWireClick(edgeId){
      Store.deleteEdge(edgeId);
      setStatus("Cable eliminado");
      renderWires();
    }
  });
}

const connectors = initConnectors({
  wiresSvg: wires,
  canvasEl: canvas,
  store: Store,
  renderWires
});

// ----------------- Sidebar listeners -----------------
propName.addEventListener("input", () => {
  if (!selectedNodeId) return;
  Store.updateNode(selectedNodeId, { name: propName.value });
  render();
});

propType.addEventListener("change", () => {
  if (!selectedNodeId) return;
  Store.updateNode(selectedNodeId, { type: propType.value });
  syncSidebar();
  render();
});

propConfig.addEventListener("input", () => {
  if (!selectedNodeId) return;
  const txt = propConfig.value.trim();
  if (!txt){
    Store.updateNode(selectedNodeId, { config: {} });
    propConfigHelp.textContent = "";
    return;
  }
  try{
    const cfg = JSON.parse(txt);
    Store.updateNode(selectedNodeId, { config: cfg });
    propConfigHelp.textContent = "";
  }catch{
    propConfigHelp.textContent = "⚠️ JSON inválido (no se aplica hasta que sea válido).";
  }
});

btnDeleteNode.addEventListener("click", () => {
  if (!selectedNodeId) return;
  Store.deleteNode(selectedNodeId);
  selectedNodeId = null;
  syncSidebar();
  render();
  setStatus("Nodo eliminado");
});

workspace.addEventListener("mousedown", (ev) => {
  if (ev.target.closest(".node")) return;
  if (ev.target.closest(".sidebar")) return;
  if (spaceDown) return;
  if (didPan) return;
  selectedNodeId = null;
  syncSidebar();
  render();
});

// ----------------- Pan / Zoom -----------------
document.addEventListener("keydown", (ev) => {
  if (ev.code === "Space") spaceDown = true;
});
document.addEventListener("keyup", (ev) => {
  if (ev.code === "Space") spaceDown = false;
});

function startPan(ev){
  isPanning = true;
  didPan = false;
  panStart = { mx: ev.clientX, my: ev.clientY, x: view.x, y: view.y };
  canvas.classList.add("panning");
  ev.preventDefault();
}

function movePan(ev){
  if (!isPanning) return;
  const dx = ev.clientX - panStart.mx;
  const dy = ev.clientY - panStart.my;
  if (Math.abs(dx) + Math.abs(dy) > 2) didPan = true;

  view.x = panStart.x + dx;
  view.y = panStart.y + dy;
  applyView();
}

function stopPan(){
  if (!isPanning) return;
  isPanning = false;
  canvas.classList.remove("panning");
  setTimeout(() => { didPan = false; }, 0);
}

workspace.addEventListener("mousedown", (ev) => {
  if (ev.button !== 0) return; // solo izquierdo


  if (ev.target.closest(".sidebar")) return;


  if (ev.target.closest(".port")) return;

  const clickedNode = !!ev.target.closest(".node");
o
  if (clickedNode && !spaceDown) return;


  startPan(ev);
});

document.addEventListener("mousemove", movePan);
document.addEventListener("mouseup", stopPan);

workspace.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  const zoomIntensity = 0.0012;
  const delta = -ev.deltaY;
  const factor = Math.exp(delta * zoomIntensity);

  const before = screenToWorld(ev.clientX, ev.clientY);
  view.scale = clamp(view.scale * factor, 0.35, 2.5);
  const after = screenToWorld(ev.clientX, ev.clientY);

  view.x += (after.x - before.x) * view.scale;
  view.y += (after.y - before.y) * view.scale;

  applyView();
}, { passive:false });

// ----------------- Toolbar -----------------
document.getElementById("btnAdd").addEventListener("click", () => {
  const rect = workspace.getBoundingClientRect();
  const w = screenToWorld(rect.left + rect.width*0.5, rect.top + rect.height*0.5);

  const n = Store.addNode({
    name: `Nodo ${Object.keys(Store.state.nodes).length + 1}`,
    type: "generic",
    x: w.x - 120,
    y: w.y - 60,
    config: {}
  });

  selectNode(n.id);
  setStatus(`Creado ${n.id}`);
});

document.getElementById("btnSave").addEventListener("click", async () => {
  try{
    setStatus("Guardando...");
    const res = await saveWorkflow(Store.serialize());
    setStatus(res.ok ? "Guardado ✅" : (res.error || "Error al guardar"));
  }catch{
    setStatus("Error al guardar");
  }
});

document.getElementById("btnLoad").addEventListener("click", async () => {
  try{
    setStatus("Cargando...");
    const res = await loadWorkflow();
    if (!res.ok) return setStatus(res.error || "Error al cargar");
    Store.hydrate(res.data);
    selectedNodeId = null;
    syncSidebar();
    render();
    setStatus("Cargado ✅");
  }catch{
    setStatus("Error al cargar");
  }
});

document.getElementById("btnRun").addEventListener("click", async () => {
  runLogEl.textContent = "";
  const lines = [];
  const log = (s) => { lines.push(s); runLogEl.textContent = lines.join("\n"); };

  setStatus("Validando...");
  const v = validateWorkflow(Store);
  if (!v.ok){
    log("❌ Validación fallida:");
    v.errors.forEach(e => log(`- ${e}`));
    setStatus("Workflow inválido");
    return;
  }

  setStatus("Ejecutando...");
  try{
    await runWorkflow({ store: Store, log });
    setStatus("Ejecución ✅");
  }catch(e){
    log(`❌ Error: ${String(e?.message ?? e)}`);
    setStatus("Error al ejecutar");
  }
});

// ----------------- Init -----------------
try{
  Store.addNode({ name:"Start", type:"trigger", x:120, y:120, config: clone(NodeTypes.trigger.defaults) });
  Store.addNode({ name:"HTTP", type:"http", x:440, y:220, config: clone(NodeTypes.http.defaults) });
  Store.addNode({ name:"Transform", type:"transform", x:760, y:220, config: clone(NodeTypes.transform.defaults) });
  Store.addNode({ name:"Log", type:"log", x:1080, y:220, config: clone(NodeTypes.log.defaults) });

  applyView();
  syncSidebar();
  render();
  setStatus("Listo");
}catch(e){
  console.error("Init error:", e);
  setStatus("Error JS (mira consola)");
}

