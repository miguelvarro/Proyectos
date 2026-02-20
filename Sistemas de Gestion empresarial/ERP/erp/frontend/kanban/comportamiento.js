let estado = null;
let dragged = null;

const CONT = document.querySelector("#kanban");
const btnGuardar = document.querySelector("#btnGuardar");
const estadoGuardar = document.querySelector("#estadoGuardar");


const searchInput = document.querySelector("#searchKanban");
const btnExport = document.querySelector("#btnExport");
const btnImport = document.querySelector("#btnImport");
const fileImport = document.querySelector("#fileImport");

let filtro = "";
let autosaveTimer = null;
let autosaveCooldown = null;

(async function init(){
  // servidor si existe
  try {
    const r = await fetch("../../backend/data/kanban.json", { cache: "no-store" });
    if (r.ok) {
      estado = await r.json();
      normalizeState();
      persist();
      render();
      setSaved("Cargado");
      return;
    }
  } catch(e){}

  // localStorage
  const cache = localStorage.getItem("kanbanJSON");
  if (cache) {
    try {
      estado = JSON.parse(cache);
      normalizeState();
      render();
      setSaved("Cargado");
      return;
    } catch(e){}
  }

  // plantilla
  fetch("kanban.json")
    .then(r => r.json())
    .then(data => {
      estado = data;
      normalizeState();
      persist();
      render();
      setSaved("Listo");
    })
    .catch(err => console.error(err));
})();

function normalizeState(){
  if (!estado || typeof estado !== "object") estado = { columnas: [] };
  if (!Array.isArray(estado.columnas)) estado.columnas = [];
  estado.columnas.forEach(c => {
    if (!Array.isArray(c.tarjetas)) c.tarjetas = [];
  });
}

function persist(){
  localStorage.setItem("kanbanJSON", JSON.stringify(estado));
}

function setSaved(msg){
  if (estadoGuardar) estadoGuardar.textContent = msg || "";
}

function setSaving(msg){
  if (estadoGuardar) estadoGuardar.textContent = msg || "Guardando...";
}

// -------- BUSCADOR --------
searchInput?.addEventListener("input", () => {
  filtro = (searchInput.value || "").trim().toLowerCase();
  render();
});

// -------- EXPORTAR --------
btnExport?.addEventListener("click", () => {
  if (!estado) return;
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kanban_export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
});

// -------- IMPORTAR --------
btnImport?.addEventListener("click", () => fileImport?.click());

fileImport?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!imported || typeof imported !== "object" || !Array.isArray(imported.columnas)) {
      alert("JSON inválido: debe contener { columnas: [...] }");
      return;
    }

    if (!confirm("Esto reemplazará tu Kanban actual. ¿Continuar?")) return;

    estado = imported;
    normalizeState();
    persist();
    render();

    await guardarEnServidor();
    setSaved("✅ Importado y guardado");
  } catch(err){
    alert("No se pudo importar: " + err.message);
  } finally {
    fileImport.value = "";
  }
});

// -------- AUTO-GUARDADO --------
// Guardar al servidor con debounce 
function scheduleAutosave(){
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    guardarEnServidor().catch(()=>{});
  }, 1200);
}

function markDirty(){
  if (autosaveCooldown) clearTimeout(autosaveCooldown);
  autosaveCooldown = setTimeout(() => {
    scheduleAutosave();
  }, 300);
}
setInterval(() => {
  if (autosaveTimer) return;
  if (document.activeElement && document.activeElement.isContentEditable) return;
  guardarEnServidor(true).catch(()=>{});
}, 20000);

// -------- RENDER --------
function render(){
  CONT.innerHTML = "";

  (estado.columnas || []).forEach((col, colIdx) => {
    CONT.appendChild(creaColumna(col, colIdx));
  });

  CONT.appendChild(creaBotonNuevaColumna());
}

function creaColumna(col, colIdx){
  const wrap = document.createElement("div");
  wrap.className = "columna";

  const head = document.createElement("div");
  head.className = "col-head";

  const title = document.createElement("div");
  title.className = "col-title";
  title.contentEditable = "true";
  title.spellcheck = false;
  title.textContent = col.nombre || "Sin nombre";

  title.addEventListener("keydown", (e)=>{ if (e.key === "Enter"){ e.preventDefault(); title.blur(); }});
  title.addEventListener("blur", ()=>{
    estado.columnas[colIdx].nombre = title.textContent.trim() || "Sin nombre";
    persist();
    markDirty();
    scheduleAutosave();
  });

  const btnAdd = document.createElement("button");
  btnAdd.className = "icon-btn";
  btnAdd.textContent = "＋";
  btnAdd.title = "Añadir tarjeta";
  btnAdd.onclick = ()=> {
    const texto = prompt("Texto de la tarjeta:");
    if (!texto) return;
    const color = prompt("Color (ej: lightblue, orange, yellow...):", "lightblue") || "lightblue";
    estado.columnas[colIdx].tarjetas.push({ texto, color });
    persist();
    markDirty();
    render();
    scheduleAutosave();
  };

  const btnDel = document.createElement("button");
  btnDel.className = "icon-btn";
  btnDel.textContent = "🗑";
  btnDel.title = "Borrar columna";
  btnDel.onclick = ()=>{
    if (!confirm("¿Borrar columna?")) return;
    estado.columnas.splice(colIdx, 1);
    persist();
    markDirty();
    render();
    scheduleAutosave();
  };

  head.appendChild(title);
  head.appendChild(btnAdd);
  head.appendChild(btnDel);

  const zone = document.createElement("div");
  zone.className = "dropzone";

  zone.addEventListener("dragover", (e)=>{ e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", ()=> zone.classList.remove("over"));
  zone.addEventListener("drop", (e)=>{
    e.preventDefault();
    zone.classList.remove("over");
    if (!dragged) return;

    const { fromCol, fromIdx } = dragged;
    const card = estado.columnas[fromCol].tarjetas.splice(fromIdx, 1)[0];
    estado.columnas[colIdx].tarjetas.push(card);

    dragged = null;
    persist();
    markDirty();
    render();
    scheduleAutosave();
  });

  // Render tarjetas con filtro
  (col.tarjetas || []).forEach((t, idx) => {
    if (filtro) {
      const hay = (t.texto || "").toLowerCase().includes(filtro);
      if (!hay) return;
    }
    zone.appendChild(creaTarjeta(t, colIdx, idx));
  });

  wrap.appendChild(head);
  wrap.appendChild(zone);
  return wrap;
}

function creaTarjeta(t, colIdx, idx){
  const card = document.createElement("div");
  card.className = "tarjeta";
  card.draggable = true;
  card.style.borderLeftColor = t.color || "lightblue";

  card.addEventListener("dragstart", ()=>{
    dragged = { fromCol: colIdx, fromIdx: idx };
  });

  const txt = document.createElement("div");
  txt.className = "texto";
  txt.contentEditable = "true";
  txt.spellcheck = false;
  txt.textContent = t.texto || "";

  txt.addEventListener("keydown", (e)=>{ if (e.key === "Enter"){ e.preventDefault(); txt.blur(); }});
  txt.addEventListener("blur", ()=>{
    estado.columnas[colIdx].tarjetas[idx].texto = txt.textContent;
    persist();
    markDirty();
    scheduleAutosave();
  });

  const btnDel = document.createElement("button");
  btnDel.className = "del";
  btnDel.textContent = "Eliminar";
  btnDel.onclick = ()=>{
    estado.columnas[colIdx].tarjetas.splice(idx, 1);
    persist();
    markDirty();
    render();
    scheduleAutosave();
  };

  card.appendChild(txt);
  card.appendChild(btnDel);
  return card;
}

// Columna Añadir
function creaBotonNuevaColumna(){
  const wrap = document.createElement("div");
  wrap.className = "columna add-col";

  const btn = document.createElement("button");
  btn.className = "add-btn";
  btn.type = "button";
  btn.innerHTML = `<span class="plus">＋</span><span>Añadir columna</span>`;

  btn.onclick = ()=>{
    const nombre = prompt("Nombre de la columna:");
    if (!nombre) return;
    estado.columnas.push({ nombre, tarjetas: [] });
    persist();
    markDirty();
    render();
    scheduleAutosave();
  };

  wrap.appendChild(btn);
  return wrap;
}

// Guardado manual
btnGuardar?.addEventListener("click", async ()=>{
  await guardarEnServidor(false);
});

// Guardar servidor
async function guardarEnServidor(silencioso){
  if (!estado) return;

  try{
    if (!silencioso) setSaving("Guardando...");
    const r = await fetch("../../backend/savekanban.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: estado })
    });

    const j = await r.json();
    if (j.ok) {
      if (!silencioso) setSaved("✅ Guardado");
    } else {
      if (!silencioso) setSaved("❌ " + (j.error || "Error"));
    }
  } catch(e){
    if (!silencioso) setSaved("❌ Error de red");
  }
}

